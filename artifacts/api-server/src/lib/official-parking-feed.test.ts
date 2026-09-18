import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  garagesTable,
  parkingObservationsTable,
  parkingReportsTable,
} from "@workspace/db";
import {
  getGarageIdForOfficialLocation,
  parseOfficialParkingFeed,
  syncOfficialParkingAvailability,
} from "./official-parking-feed";

describe("official FGCU parking feed", () => {
  const garageId = "science-center";
  const userId = `calibration-test-${randomUUID()}`;
  const observedAt = new Date("2026-09-18T16:30:45.000Z");
  let originalGarage: typeof garagesTable.$inferSelect | undefined;

  beforeAll(async () => {
    [originalGarage] = await db
      .select()
      .from(garagesTable)
      .where(eq(garagesTable.id, garageId));
  });

  afterAll(async () => {
    await db
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.userId, userId));
    await db
      .delete(parkingObservationsTable)
      .where(eq(parkingObservationsTable.observedAt, observedAt));
    if (originalGarage) {
      await db
        .update(garagesTable)
        .set({
          availableSpots: originalGarage.availableSpots,
          totalSpots: originalGarage.totalSpots,
          availabilityUpdatedAt: originalGarage.availabilityUpdatedAt,
        })
        .where(eq(garagesTable.id, garageId));
    }
  });

  it("parses the documented Parking Logix widget response", () => {
    const observations = parseOfficialParkingFeed({
      widgetData: [
        {
          locationName: "Parking Garage 2",
          freeSpaces: "117",
          totalSpaces: 310,
          dateTime: "2026-09-18 12:30:45",
        },
      ],
    });

    expect(observations).toEqual([
      {
        locationName: "Parking Garage 2",
        availableSpots: 117,
        totalSpots: 310,
        observedAt: new Date("2026-09-18T16:30:45.000Z"),
      },
    ]);
  });

  it("maps only the four FGCU garages represented in UPARK", () => {
    expect(getGarageIdForOfficialLocation("Garage 1")).toBe("north-deck");
    expect(getGarageIdForOfficialLocation("PG2")).toBe("science-center");
    expect(getGarageIdForOfficialLocation("Parking Garage 3")).toBe(
      "library-garage",
    );
    expect(getGarageIdForOfficialLocation("Parking Garage 4")).toBe(
      "arts-garage",
    );
    expect(getGarageIdForOfficialLocation("Parking Garage B")).toBeNull();
    expect(getGarageIdForOfficialLocation("Lot P6")).toBeNull();
  });

  it("rejects values without a trustworthy observation time", () => {
    expect(
      parseOfficialParkingFeed({
        widgetData: [
          {
            locationName: "Parking Garage 1",
            freeSpaces: 50,
            totalSpaces: 420,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects malformed response envelopes", () => {
    expect(() => parseOfficialParkingFeed({ error: "unavailable" })).toThrow(
      "widgetData",
    );
  });

  it("stores the report estimate that preceded a trusted observation", async () => {
    await db
      .update(garagesTable)
      .set({ availabilityUpdatedAt: null, availableSpots: 50, totalSpots: 100 })
      .where(eq(garagesTable.id, garageId));
    await db.insert(parkingReportsTable).values({
      userId,
      garageId,
      availabilityStatus: "filling_up",
      isVerified: true,
      createdAt: new Date(observedAt.getTime() - 5 * 60_000),
    });

    await syncOfficialParkingAvailability(
      async () => ({
        widgetData: [
          {
            locationName: "Parking Garage 2",
            freeSpaces: 40,
            totalSpaces: 100,
            dateTime: "2026-09-18 12:30:45",
          },
        ],
      }),
      new Date(observedAt.getTime() + 60_000),
    );

    const [stored] = await db
      .select()
      .from(parkingObservationsTable)
      .where(eq(parkingObservationsTable.observedAt, observedAt));
    expect(stored).toMatchObject({
      garageId,
      availableSpots: 40,
      totalSpots: 100,
      precedingEstimateSpots: 25,
      precedingEstimateSource: "verified_reports",
      precedingEstimateConfidence: "low",
      precedingReportCount: 1,
    });
  });
});