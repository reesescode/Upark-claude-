import { describe, expect, it } from "vitest";
import {
  hasCompletedOnboarding,
  ONBOARDING_METADATA_KEY,
  ONBOARDING_NEW_USER_CUTOFF,
  shouldShowOnboarding,
} from "./onboarding";

describe("onboarding completion", () => {
  it("shows onboarding for a new profile without the completion flag", () => {
    expect(hasCompletedOnboarding(undefined)).toBe(false);
    expect(hasCompletedOnboarding({})).toBe(false);
    expect(hasCompletedOnboarding({ [ONBOARDING_METADATA_KEY]: false })).toBe(false);
  });

  it("only considers an explicit completed flag as finished", () => {
    expect(hasCompletedOnboarding({ [ONBOARDING_METADATA_KEY]: true })).toBe(true);
    expect(hasCompletedOnboarding({ [ONBOARDING_METADATA_KEY]: "true" })).toBe(false);
  });

  it("never prompts accounts that existed before the new-user rollout", () => {
    expect(shouldShowOnboarding(new Date(ONBOARDING_NEW_USER_CUTOFF - 1), {})).toBe(false);
    expect(shouldShowOnboarding(null, {})).toBe(false);
  });

  it("prompts new accounts once, then respects their saved completion", () => {
    const createdAt = new Date(ONBOARDING_NEW_USER_CUTOFF);
    expect(shouldShowOnboarding(createdAt, {})).toBe(true);
    expect(shouldShowOnboarding(createdAt, { [ONBOARDING_METADATA_KEY]: true })).toBe(false);
  });
});