import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { getGetUserProfileQueryKey, useGetUserProfile, useUpsertUserProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AccountSetup() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const pendingProfile = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("upark_pending_profile") || "{}") as {
        firstName?: string;
        lastName?: string;
        university?: string;
      };
    } catch {
      return {};
    }
  })();
  const [firstName, setFirstName] = useState(pendingProfile.firstName || "");
  const [lastName, setLastName] = useState(pendingProfile.lastName || "");
  const [university, setUniversity] = useState(
    pendingProfile.university || "Florida Gulf Coast University (FGCU)",
  );
  const [error, setError] = useState("");
  const profile = useGetUserProfile(user?.id || "", {
    query: {
      enabled: !!user?.id,
      queryKey: getGetUserProfileQueryKey(user?.id || ""),
      retry: false,
    },
  });
  const save = useUpsertUserProfile();

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);
  useEffect(() => {
    const savedProfile = profile.data;
    if (
      savedProfile &&
      savedProfile.authUserId === user?.id &&
      savedProfile.firstName &&
      savedProfile.lastName &&
      savedProfile.email &&
      savedProfile.university
    ) {
      setLocation("/profile");
    }
  }, [profile.data, setLocation, user?.id]);
  useEffect(() => {
    if (isLoaded && !user) setLocation("/sign-in");
  }, [isLoaded, user, setLocation]);
  if (!user) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError("");
    try {
      await save.mutateAsync({
        userId: user.id,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: user.primaryEmailAddress?.emailAddress || "",
          university: university.trim(),
        },
      });
      sessionStorage.removeItem("upark_pending_profile");
      toast({ title: "Account created", description: "Your UPARK profile is ready." });
      setLocation("/profile");
    } catch {
      setError("We could not save your profile. Your entries are still here—please try again.");
    }
  };
  return (
    <div className="min-h-[100dvh] bg-primary/5 p-5 flex items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl space-y-5">
        <div><h1 className="text-2xl font-black">Complete your profile</h1><p className="text-gray-500 mt-1">Tell UPARK where you study.</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="first-name">First name</Label><Input id="first-name" value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
          <div><Label htmlFor="last-name">Last name</Label><Input id="last-name" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
        </div>
        <div><Label htmlFor="email">Email</Label><Input id="email" value={user?.primaryEmailAddress?.emailAddress || ""} disabled /></div>
        <div><Label htmlFor="university">University</Label><Input id="university" value={university} onChange={e => setUniversity(e.target.value)} required /></div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
        <Button type="submit" className="w-full h-12 rounded-xl" disabled={save.isPending || !firstName.trim() || !lastName.trim() || !university.trim()}>{save.isPending ? "Saving..." : "Create UPARK Profile"}</Button>
      </form>
    </div>
  );
}