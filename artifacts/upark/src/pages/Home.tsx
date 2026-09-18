import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser } from "@/hooks/use-local-data";
import { useUpsertUserProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user, login } = useUser();
  const [, setLocation] = useLocation();
  const upsertProfile = useUpsertUserProfile();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");

  useEffect(() => {
    if (user) setLocation("/map");
  }, [setLocation, user]);

  const completeLogin = async (displayName: string, userId: string) => {
    try {
      await upsertProfile.mutateAsync({
        userId,
        data: { displayName },
      });
      login(displayName, userId);
      setLocation("/map");
    } catch {
      toast({
        title: "Could not start your profile",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name && studentId) {
      await completeLogin(name.trim(), studentId.trim());
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/20 blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-white/10 blur-3xl"></div>
      </div>

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 animate-in slide-in-from-bottom-4 duration-500">
          <MapPin className="text-primary w-10 h-10" />
        </div>
        
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight animate-in slide-in-from-bottom-4 duration-500 delay-100">
          UPARK
        </h1>
        <p className="text-primary-foreground/80 text-center mb-10 text-lg animate-in slide-in-from-bottom-4 duration-500 delay-150">
          Campus parking, solved.
        </p>

        <form onSubmit={handleLogin} className="w-full bg-white rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 delay-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Student Access</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">First Name</label>
              <Input 
                placeholder="e.g. Taylor" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Student ID</label>
              <Input 
                placeholder="e.g. 1029384" 
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="bg-gray-50 border-transparent focus-visible:ring-primary/20 focus-visible:border-primary focus:bg-white"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg rounded-2xl"
            disabled={upsertProfile.isPending}
            data-testid="button-get-started"
          >
            {upsertProfile.isPending ? "Starting..." : "Get Started"}
          </Button>

          <div className="mt-4 text-center">
            <button 
              type="button"
              onClick={() => {
                void completeLogin("Demo User", "0000000");
              }}
              disabled={upsertProfile.isPending}
              data-testid="button-demo-user"
              className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip as Demo User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
