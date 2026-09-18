import { type ReactNode, useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import Home from '@/pages/Home';
import Map from '@/pages/Map';
import Garages from '@/pages/Garages';
import GarageDetails from '@/pages/GarageDetails';
import Navigate from '@/pages/Navigate';
import Favorites from '@/pages/Favorites';
import Profile from '@/pages/Profile';
import AccountSetup from '@/pages/AccountSetup';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function SignInPage() {
  return <div className="min-h-[100dvh] bg-primary/5 flex items-center justify-center p-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="min-h-[100dvh] bg-primary/5 flex items-center justify-center p-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/account-setup`} /></div>;
}

function AuthCacheInvalidator() {
  const { addListener } = useClerk();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const next = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== next) queryClient.clear();
    previous.current = next;
  }), [addListener]);
  return null;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/account-setup" component={AccountSetup} />
        <Route path="/map" component={Map} />
        <Route path="/garages" component={Garages} />
        <Route path="/garages/:id" component={GarageDetails} />
        <Route path="/navigate/:id" component={Navigate} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      appearance={{
        theme: shadcn,
        variables: {
          colorPrimary: '#2563eb',
          colorForeground: '#111827',
          colorMutedForeground: '#6b7280',
          colorBackground: '#ffffff',
          colorInput: '#f9fafb',
          colorInputForeground: '#111827',
          colorNeutral: '#d1d5db',
          borderRadius: '1rem',
          fontFamily: 'Nunito, sans-serif',
        },
        elements: { cardBox: 'w-[420px] max-w-full rounded-3xl shadow-xl' },
      }}
      localization={{
        signIn: { start: { title: 'Welcome back to UPARK', subtitle: 'Sign in to continue' } },
        signUp: { start: { title: 'Create your UPARK account', subtitle: 'Find campus parking faster' } },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function AppWithRouter() {
  return <WouterRouter base={basePath}><App /></WouterRouter>;
}

export default AppWithRouter;
