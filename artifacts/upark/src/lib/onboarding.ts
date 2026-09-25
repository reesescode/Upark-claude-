export const ONBOARDING_METADATA_KEY = "uparkOnboardingCompleted";

export function hasCompletedOnboarding(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[ONBOARDING_METADATA_KEY] === true;
}