import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/react/legacy";
import { Link, useLocation } from "wouter";
import { Loader2, MapPin } from "lucide-react";
import { useUpsertUserProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type ClerkError = {
  errors?: Array<{
    code?: string;
    message?: string;
    longMessage?: string;
  }>;
  message?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  const clerkError = error as ClerkError;
  const detail = clerkError.errors?.[0];
  if (detail?.code === "form_identifier_exists") {
    return "An account with this email already exists. Sign in instead.";
  }
  return detail?.longMessage || detail?.message || clerkError.message || fallback;
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-[100dvh] bg-primary/5 flex items-center justify-center p-4 py-8">
      <section className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100">
        <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-5">
          <MapPin className="w-7 h-7 text-white" aria-hidden="true" />
        </div>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-1">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
      data-testid="auth-error"
    >
      {message}
    </div>
  );
}

export function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const saveProfile = useUpsertUserProfile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [university, setUniversity] = useState("Florida Gulf Coast University (FGCU)");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword || !university.trim()) {
      setError("Complete all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (caught) {
      setError(getErrorMessage(caught, "We could not create your account. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!isLoaded || !code.trim()) {
      setError("Enter the verification code sent to your email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== "complete" || !result.createdSessionId || !result.createdUserId) {
        setError("Email verification is not complete. Check the code and try again.");
        return;
      }
      await setActive({ session: result.createdSessionId });
      const pendingProfile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        university: university.trim(),
      };
      sessionStorage.setItem("upark_pending_profile", JSON.stringify(pendingProfile));
      try {
        await saveProfile.mutateAsync({
          userId: result.createdUserId,
          data: pendingProfile,
        });
      } catch {
        toast({
          title: "Account created, profile setup needed",
          description: "Your login is ready, but we could not save your UPARK profile. Please try again.",
          variant: "destructive",
        });
        setLocation("/account-setup");
        return;
      }
      sessionStorage.removeItem("upark_pending_profile");
      toast({
        title: "Account created successfully",
        description: "Welcome to UPARK.",
      });
      setLocation("/map");
    } catch (caught) {
      setError(getErrorMessage(caught, "We could not verify your email. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "verify") {
    return (
      <AuthShell title="Verify your email" subtitle={`We sent a code to ${email.trim().toLowerCase()}`}>
        <form onSubmit={verifyEmail} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification code</Label>
            <Input
              id="verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              data-testid="input-verification-code"
            />
          </div>
          <ErrorMessage message={error} />
          <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isSubmitting || !isLoaded}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating account..." : "Verify and create account"}
          </Button>
          <button
            type="button"
            className="w-full text-sm font-semibold text-primary"
            onClick={() => {
              setError("");
              setCode("");
              setStep("details");
            }}
          >
            Change account details
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your UPARK account" subtitle="Find campus parking faster">
      <form onSubmit={submitDetails} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="signup-first-name">First name</Label>
            <Input id="signup-first-name" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required data-testid="input-first-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-last-name">Last name</Label>
            <Input id="signup-last-name" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required data-testid="input-last-name" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required data-testid="input-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-university">University</Label>
          <Input id="signup-university" autoComplete="organization" value={university} onChange={(event) => setUniversity(event.target.value)} required data-testid="input-university" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required data-testid="input-password" />
          <p className="text-xs text-gray-500">Use at least 8 characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-confirm-password">Confirm password</Label>
          <Input id="signup-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required data-testid="input-confirm-password" />
        </div>
        <ErrorMessage message={error} />
        <div id="clerk-captcha" />
        {isSubmitting && (
          <p className="text-center text-sm font-medium text-gray-600" role="status">
            Complete the security check above if prompted.
          </p>
        )}
        <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isSubmitting || !isLoaded}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Creating account..." : "Create Account"}
        </Button>
        <p className="text-center text-sm text-gray-500">
          Already have an account? <Link href="/sign-in" className="font-bold text-primary">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"password" | "verify">("password");
  const [verificationFactor, setVerificationFactor] = useState<"first" | "second">("second");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      await signIn.create({
        identifier: email.trim().toLowerCase(),
      });
      const result = await signIn.attemptFirstFactor({
        strategy: "password",
        password,
      });
      if (result.status === "needs_first_factor") {
        const emailFactor = result.supportedFirstFactors?.find(
          (factor) => factor.strategy === "email_code",
        );
        if (!emailFactor || !("emailAddressId" in emailFactor)) {
          setError("This account requires a sign-in method UPARK does not support yet.");
          return;
        }
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        });
        setVerificationFactor("first");
        setStep("verify");
        return;
      }
      if (result.status === "needs_second_factor") {
        const emailFactor = result.supportedSecondFactors?.find(
          (factor) => factor.strategy === "email_code",
        );
        if (!emailFactor || !("emailAddressId" in emailFactor)) {
          setError("This account requires a verification method UPARK does not support yet.");
          return;
        }
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        });
        setVerificationFactor("second");
        setStep("verify");
        return;
      }
      if (result.status !== "complete" || !result.createdSessionId) {
        setError("Your sign-in could not be completed. Please try again.");
        return;
      }
      await setActive({ session: result.createdSessionId });
      setLocation("/map");
    } catch (caught) {
      setError(getErrorMessage(caught, "Incorrect email or password."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!isLoaded || !code.trim()) {
      setError("Enter the verification code sent to your email.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result =
        verificationFactor === "first"
          ? await signIn.attemptFirstFactor({
              strategy: "email_code",
              code: code.trim(),
            })
          : await signIn.attemptSecondFactor({
              strategy: "email_code",
              code: code.trim(),
            });
      if (result.status !== "complete" || !result.createdSessionId) {
        setError("Verification is not complete. Check the code and try again.");
        return;
      }
      await setActive({ session: result.createdSessionId });
      setLocation("/map");
    } catch (caught) {
      setError(getErrorMessage(caught, "The verification code is incorrect or expired."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "verify") {
    return (
      <AuthShell title="Verify your sign-in" subtitle={`We sent a code to ${email.trim().toLowerCase()}`}>
        <form onSubmit={verify} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="signin-verification-code">Verification code</Label>
            <Input
              id="signin-verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              data-testid="input-signin-verification-code"
            />
          </div>
          <ErrorMessage message={error} />
          <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isSubmitting || !isLoaded}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Verifying..." : "Verify and sign in"}
          </Button>
          <button
            type="button"
            className="w-full text-sm font-semibold text-primary"
            onClick={() => {
              setCode("");
              setError("");
              setStep("password");
            }}
          >
            Back to sign in
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back to UPARK" subtitle="Sign in to continue">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="signin-email">Email</Label>
          <Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required data-testid="input-signin-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signin-password">Password</Label>
          <Input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required data-testid="input-signin-password" />
        </div>
        <ErrorMessage message={error} />
        <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isSubmitting || !isLoaded}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
        <p className="text-center text-sm text-gray-500">
          Need an account? <Link href="/sign-up" className="font-bold text-primary">Create one</Link>
        </p>
      </form>
    </AuthShell>
  );
}