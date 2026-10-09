import { describe, expect, it } from "vitest";
import type { Garage } from "@workspace/api-client-react";
import { getAvailabilityLabel, getLatestReportLabel, hasLiveAvailability } from "./availability-utils";

describe("reports-only lot labels", () => {
  const lot = { availabilitySource: "user_reports_only", latestReportStatus: null, availabilityUpdatedAt: null } as Garage;
  it("does not call an empty lot live or available", () => {
    expect(getAvailabilityLabel(lot)).toBe("No Recent Reports");
    expect(getLatestReportLabel(lot)).toBe("No Recent Reports");
    expect(hasLiveAvailability(lot)).toBe(false);
  });
  it("shows the reported status and age rather than a live estimate", () => {
    const reported = { ...lot, latestReportStatus: "almost_full" as const, availabilityUpdatedAt: new Date(Date.now() - 5 * 60_000).toISOString() };
    expect(getAvailabilityLabel(reported)).toMatch(/^Almost Full — reported .* ago$/);
    expect(hasLiveAvailability(reported)).toBe(false);
  });
});
