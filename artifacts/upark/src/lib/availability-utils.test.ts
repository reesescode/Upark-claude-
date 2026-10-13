import { describe, expect, it } from "vitest";
import type { Garage } from "@workspace/api-client-react";
import { getAvailabilityLabel, getLatestReportLabel, hasLiveAvailability } from "./availability-utils";

describe("reports-only lot labels", () => {
  const lot = { availabilitySource: "user_reports_only", latestReportStatus: null, availabilityUpdatedAt: null } as Garage;
  it("does not call an empty lot live or available", () => {
    expect(getAvailabilityLabel(lot)).toBe("Student updates are in the Reports section.");
    expect(getLatestReportLabel(lot)).toBe("See Reports");
    expect(hasLiveAvailability(lot)).toBe(false);
  });
  it("keeps report status and age out of availability labels", () => {
    const reported = { ...lot, latestReportStatus: "almost_full" as const, availabilityUpdatedAt: new Date(Date.now() - 5 * 60_000).toISOString() };
    expect(getAvailabilityLabel(reported)).toBe("Student updates are in the Reports section.");
    expect(getLatestReportLabel(reported)).toBe("See Reports");
    expect(hasLiveAvailability(reported)).toBe(false);
  });
});
