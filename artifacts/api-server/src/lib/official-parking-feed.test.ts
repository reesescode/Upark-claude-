import { describe, expect, it } from "vitest";
import {
  getGarageIdForOfficialLocation,
  parseOfficialParkingFeed,
} from "./official-parking-feed";

describe("official FGCU parking feed", () => {
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
});