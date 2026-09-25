import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import Onboarding from "./Onboarding";
import { hasCompletedOnboarding, ONBOARDING_METADATA_KEY } from "@/lib/onboarding";

export default function OnboardingRoute() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !user) setLocation("/sign-in", { replace: true });
  }, [isLoaded, user, setLocation]);

  if (!isLoaded) return null;
  if (!user) return null;

  const finish = async () => {
    if (!hasCompletedOnboarding(user.unsafeMetadata)) {
      await user.update({
        unsafeMetadata: { ...user.unsafeMetadata, [ONBOARDING_METADATA_KEY]: true },
      });
      await user.reload();
    }
    setLocation("/map", { replace: true });
  };

  return <Onboarding onFinish={finish} />;
}