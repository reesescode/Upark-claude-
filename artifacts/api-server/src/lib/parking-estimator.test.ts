import { describe, expect, it } from "vitest";
import type {
  GarageRecord,
  ParkingObservationRecord,
  ParkingReportRecord,
} from "@workspace/db";
import {
  buildCalibratedRatios,
  estimateGarageAvailability,
  LIVE_WINDOW_MS,
} from "./parking-estimator";

const garage = {
  id: "calibration-garage",
  name: "Calibration Garage",
  shortName: "Calibration",
  address: "Test",
  type: "garage",
  availableSpots: 50,
  availabilityUpdatedAt: null,
  totalSpots: 100,
  distanceMiles: 0,
  driveTimeMinutes: 0,
  walkingTimeMinutes: 0,
  openHours: "24 hours",
  price: "Free",
  permits: [],
  latitude: 0,
  longitude: 0,
  updatedAt: new Date(0),
} satisfies GarageRecord;

function report(
  id: number,
  status: ParkingReportRecord["availabilityStatus"],
  createdAt: Date,
) {
  return {
    id,
    garageId: garage.id,
    userId: `student-${id}`,
    availabilityStatus: status,
    createdAt,
  };
}

function observation(
  availableSpots: number,
  observedAt: Date,
): Pick<
  ParkingObservationRecord,
  "availableSpots" | "totalSpots" | "observedAt"
> {
  return { availableSpots, totalSpots: 100, observedAt };
}

describe("parking estimate calibration", () => {
  it("keeps default ratios and low confidence when outcome data is sparse", () => {
    const now = new Date("2026-09-18T16:00:00.000Z");
    const liveReport = report(1, "filling_up", now);
    const estimate = estimateGarageAvailability(
      garage,
      [liveReport],
      [liveReport],
      [observation(80, now)],
      now,
    );

    expect(estimate.availableSpots).toBe(25);
    expect(estimate.availabilityConfidence).toBe("low");
  });

  it("learns a location's category ratio after enough trusted outcomes", () => {
    const base = new Date("2026-09-18T10:00:00.000Z");
    const calibrationReports = Array.from({ length: 20 }, (_, index) =>
      report(index + 1, "full", new Date(base.getTime() + index * 60_000)),
    );
    const observations = calibrationReports.map((item) =>
      observation(20, new Date(item.createdAt.getTime() + 5 * 60_000)),
    );
    const now = new Date("2026-09-19T10:00:00.000Z");
    const liveReport = report(100, "full", now);

    const estimate = estimateGarageAvailability(
      garage,
      [liveReport],
      calibrationReports,
      observations,
      now,
    );

    expect(estimate.availableSpots).toBe(20);
    expect(estimate.availabilityConfidence).toBe("high");
  });

  it("weights recent report outcomes more than older ones", () => {
    const observedAt = new Date("2026-09-18T12:00:00.000Z");
    const freshReports = Array.from({ length: 10 }, (_, index) =>
      report(index + 1, "almost_full", new Date(observedAt.getTime() - 60_000)),
    );
    const oldReports = Array.from({ length: 10 }, (_, index) =>
      report(
        index + 20,
        "almost_full",
        new Date(observedAt.getTime() - LIVE_WINDOW_MS + 60_000),
      ),
    );
    const freshCalibration = buildCalibratedRatios(freshReports, [
      observation(30, observedAt),
    ]);
    const oldCalibration = buildCalibratedRatios(oldReports, [
      observation(0, observedAt),
    ]);
    const combined = buildCalibratedRatios(
      [...freshReports, ...oldReports],
      [observation(30, observedAt)],
    );

    expect(freshCalibration.ratios.almost_full).toBeGreaterThan(
      oldCalibration.ratios.almost_full,
    );
    expect(combined.ratios.almost_full).toBeGreaterThan(0.2);
  });
});