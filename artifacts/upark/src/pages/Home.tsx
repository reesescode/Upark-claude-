import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (isLoaded && isSignedIn) setLocation("/map");
  }, [isLoaded, isSignedIn, setLocation]);
  if (!isLoaded || isSignedIn) return null;
  return (
    <div className="min-h-[100dvh] bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="w-full max-w-sm relative z-10 text-center">
        <div className="w-20 h-20 mx-auto bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
          <MapPin className="text-primary w-10 h-10" />
        </div>
        <h1 className="text-4xl font-black text-white mb-2">UPARK</h1>
        <p className="text-primary-foreground/80 mb-10 text-lg">Campus parking, solved.</p>
        <div className="bg-white rounded-3xl p-6 shadow-2xl space-y-3">
          <Link href="/sign-up"><Button className="w-full h-14 rounded-2xl text-lg">Create Account</Button></Link>
          <Link href="/sign-in"><Button variant="outline" className="w-full h-14 rounded-2xl text-lg">Sign In</Button></Link>
          <p className="text-xs text-gray-500 pt-2">Your password is securely handled by UPARK authentication and is never stored in your profile.</p>
        </div>
      </div>
    </div>
  );
}