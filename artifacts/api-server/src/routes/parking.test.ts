import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  garagesTable,
  parkingReportsTable,
  pool,
} from "@workspace/db";
import app from "../app";

const garageId = `parking-test-${randomUUID()}`;

describe("parking report routes", () => {
  beforeAll(async () => {
    await db.insert(garagesTable).values({
      id: garageId,
      name: "Parking Report Test Garage",
      shortName: "PR Test",
      address: "1 Test Way",
      type: "garage",
      availableSpots: 50,
      totalSpots: 100,
      distanceMiles: 0.5,
      driveTimeMinutes: 2,
      walkingTimeMinutes: 5,
      openHours: "24 hours",
      price: "Free",
      permits: ["student"],
      latitude: 0,
      longitude: 0,
    });
  });

  afterAll(async () => {
    await db.delete(garagesTable).where(eq(garagesTable.id, garageId));
    await pool.end();
  });

  it("creates and persists a valid report with its database timestamp", async () => {
    const beforeRequest = Date.now();
    const response = await request(app)
      .post(`/api/garages/${garageId}/reports`)
      .send({
        userId: "api-test-user",
        availabilityStatus: "plenty_spots",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      garageId,
      availabilityStatus: "plenty_spots",
    });
    expect(Date.parse(response.body.createdAt)).toBeGreaterThanOrEqual(
      beforeRequest - 1_000,
    );

    const [stored] = await db
      .select()
      .from(parkingReportsTable)
      .where(eq(parkingReportsTable.id, response.body.id));

    expect(stored).toBeDefined();
    expect(stored?.userId).toBe("api-test-user");
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.createdAt.toISOString()).toBe(response.body.createdAt);
  });

  it("rejects invalid availability statuses without writing a report", async () => {
    const before = await db
      .select({ id: parkingReportsTable.id })
      .from(parkingReportsTable)
      .where(eq(parkingReportsTable.garageId, garageId));

    await request(app)
      .post(`/api/garages/${garageId}/reports`)
      .send({
        userId: "api-test-user",
        availabilityStatus: "maybe_open",
      })
      .expect(400);

    const after = await db
      .select({ id: parkingReportsTable.id })
      .from(parkingReportsTable)
      .where(eq(parkingReportsTable.garageId, garageId));
    expect(after).toHaveLength(before.length);
  });

  it("returns 404 when creating a report for a missing garage", async () => {
    await request(app)
      .post(`/api/garages/missing-${randomUUID()}/reports`)
      .send({
        userId: "api-test-user",
        availabilityStatus: "full",
      })
      .expect(404, { error: "Garage not found" });
  });

  it("returns 404 when listing reports for a missing garage", async () => {
    await request(app)
      .get(`/api/garages/missing-${randomUUID()}/reports`)
      .expect(404, { error: "Garage not found" });
  });

  it("lists reports newest first, using id as a stable timestamp tie-breaker", async () => {
    await db
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.garageId, garageId));

    const older = new Date("2026-01-01T10:00:00.000Z");
    const newer = new Date("2026-01-01T11:00:00.000Z");
    await db.insert(parkingReportsTable).values([
      {
        userId: "older",
        garageId,
        availabilityStatus: "plenty_spots",
        createdAt: older,
      },
      {
        userId: "newer-first",
        garageId,
        availabilityStatus: "full",
        createdAt: newer,
      },
      {
        userId: "newer-second",
        garageId,
        availabilityStatus: "almost_full",
        createdAt: newer,
      },
    ]);

    const response = await request(app)
      .get(`/api/garages/${garageId}/reports`)
      .expect(200);

    expect(
      response.body.map(
        (report: { availabilityStatus: string }) =>
          report.availabilityStatus,
      ),
    ).toEqual(["almost_full", "full", "plenty_spots"]);
    expect(response.body.map((report: { createdAt: string }) => report.createdAt))
      .toEqual([newer.toISOString(), newer.toISOString(), older.toISOString()]);
  });
});