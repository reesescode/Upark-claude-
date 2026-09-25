import { describe, expect, it } from "vitest";
import { hasCompletedOnboarding, ONBOARDING_METADATA_KEY } from "./onboarding";

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
});