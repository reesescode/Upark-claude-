export const ONBOARDING_METADATA_KEY = "uparkOnboardingCompleted";
// Accounts that existed before the tutorial's new-user rollout should not be
// prompted just because they have no completion flag. Keep this cutoff fixed.
export const ONBOARDING_NEW_USER_CUTOFF = Date.parse("2026-09-25T20:04:04Z");

export function hasCompletedOnboarding(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[ONBOARDING_METADATA_KEY] === true;
}

export function shouldShowOnboarding(
  createdAt: Date | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return !!createdAt &&
    createdAt.getTime() >= ONBOARDING_NEW_USER_CUTOFF &&
    !hasCompletedOnboarding(metadata);
}