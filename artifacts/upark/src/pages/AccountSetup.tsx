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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [university, setUniversity] = useState("Florida Gulf Coast University");
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
    if (profile.data) setLocation("/profile");
  }, [profile.data, setLocation]);
  useEffect(() => {
    if (isLoaded && !user) setLocation("/sign-in");
  }, [isLoaded, user, setLocation]);
  if (!user) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    await save.mutateAsync({
      userId: user.id,
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: user.primaryEmailAddress?.emailAddress || "",
        university: university.trim(),
      },
    });
    toast({ title: "Account created", description: "Your UPARK profile is ready." });
    setLocation("/profile");
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
        <Button type="submit" className="w-full h-12 rounded-xl" disabled={save.isPending}>{save.isPending ? "Saving..." : "Create UPARK Profile"}</Button>
      </form>
    </div>
  );
}