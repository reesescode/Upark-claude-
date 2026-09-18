import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  garagesTable,
  parkingReportsTable,
  pool,
} from "@workspace/db";
import app from "../app";

const garageId = `parking-test-${randomUUID()}`;
const demoGarageId = `parking-demo-test-${randomUUID()}`;

describe("parking report routes", () => {
  beforeAll(async () => {
    await db.insert(garagesTable).values([
      {
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
      },
      {
        id: demoGarageId,
        name: "Demo Availability Test Garage",
        shortName: "Demo Test",
        address: "2 Test Way",
        type: "garage",
        availableSpots: 25,
        totalSpots: 50,
        distanceMiles: 0.6,
        driveTimeMinutes: 3,
        walkingTimeMinutes: 6,
        openHours: "24 hours",
        price: "Free",
        permits: ["student"],
        latitude: 0,
        longitude: 0,
      },
    ]);
  });

  afterAll(async () => {
    await db
      .delete(garagesTable)
      .where(inArray(garagesTable.id, [garageId, demoGarageId]));
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

  it("limits repeated reports from the same student for the same garage", async () => {
    const userId = `rate-limited-${randomUUID()}`;
    await request(app)
      .post(`/api/garages/${garageId}/reports`)
      .send({ userId, availabilityStatus: "plenty_spots" })
      .expect(201);

    const response = await request(app)
      .post(`/api/garages/${garageId}/reports`)
      .send({ userId, availabilityStatus: "full" })
      .expect(429);

    expect(response.headers["retry-after"]).toMatch(/^\d+$/);
    expect(response.body).toMatchObject({
      error: expect.stringContaining("report again in"),
      retryAfterSeconds: expect.any(Number),
      nextAllowedAt: expect.any(String),
    });
    expect(response.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(Date.parse(response.body.nextAllowedAt)).toBeGreaterThan(Date.now());
  });

  it("allows the same student to report again after the cooldown", async () => {
    const userId = `cooled-down-${randomUUID()}`;
    await db.insert(parkingReportsTable).values({
      userId,
      garageId,
      availabilityStatus: "filling_up",
      createdAt: new Date(Date.now() - 6 * 60 * 1_000),
    });

    await request(app)
      .post(`/api/garages/${garageId}/reports`)
      .send({ userId, availabilityStatus: "almost_full" })
      .expect(201);
  });

  it("accepts only one of two simultaneous reports from the same student", async () => {
    const userId = `concurrent-${randomUUID()}`;
    const submit = (availabilityStatus: "plenty_spots" | "full") =>
      request(app)
        .post(`/api/garages/${garageId}/reports`)
        .send({ userId, availabilityStatus });

    const responses = await Promise.all([
      submit("plenty_spots"),
      submit("full"),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 429,
    ]);
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

  it("keeps seeded counts clearly marked as demo data", async () => {
    const response = await request(app)
      .get(`/api/garages/${demoGarageId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      availableSpots: 25,
      availabilitySource: "demo",
      availabilityConfidence: "unavailable",
      availabilityIsStale: false,
      availabilityReportCount: 0,
      availabilityUpdatedAt: null,
    });
  });

  it("uses recent verified reports consistently across detail, list, and summary", async () => {
    await db
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.garageId, garageId));
    const reportedAt = new Date();
    await db.insert(parkingReportsTable).values([
      {
        userId: "verified-one",
        garageId,
        availabilityStatus: "plenty_spots",
        isVerified: true,
        createdAt: reportedAt,
      },
      {
        userId: "verified-two",
        garageId,
        availabilityStatus: "filling_up",
        isVerified: true,
        createdAt: reportedAt,
      },
      {
        userId: "verified-three",
        garageId,
        availabilityStatus: "almost_full",
        isVerified: true,
        createdAt: reportedAt,
      },
    ]);

    const [detail, list, summary] = await Promise.all([
      request(app).get(`/api/garages/${garageId}`).expect(200),
      request(app).get("/api/garages").expect(200),
      request(app).get("/api/campus/summary").expect(200),
    ]);
    const listedGarage = list.body.find(
      (garage: { id: string }) => garage.id === garageId,
    );

    expect(detail.body).toMatchObject({
      availableSpots: 28,
      occupancyPercent: 72,
      availabilitySource: "verified_reports",
      availabilityConfidence: "high",
      availabilityIsStale: false,
      availabilityReportCount: 3,
      availabilityUpdatedAt: reportedAt.toISOString(),
    });
    expect(listedGarage).toEqual(detail.body);
    expect(summary.body.openSpots).toBe(
      list.body.reduce(
        (total: number, garage: { availableSpots: number }) =>
          total + garage.availableSpots,
        0,
      ),
    );
    expect(summary.body.liveGaragesCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.demoGaragesCount).toBeGreaterThanOrEqual(1);
  });

  it("identifies a single older verified report as stale and low confidence", async () => {
    await db
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.garageId, garageId));
    const reportedAt = new Date(Date.now() - 45 * 60 * 1_000);
    await db.insert(parkingReportsTable).values({
      userId: "verified-stale",
      garageId,
      availabilityStatus: "full",
      isVerified: true,
      createdAt: reportedAt,
    });

    const response = await request(app)
      .get(`/api/garages/${garageId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      availableSpots: 0,
      availabilitySource: "verified_reports",
      availabilityConfidence: "low",
      availabilityIsStale: true,
      availabilityReportCount: 1,
      availabilityUpdatedAt: reportedAt.toISOString(),
    });
  });

  it("does not let unverified student reports replace demo availability", async () => {
    await db
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.garageId, garageId));
    await db.insert(parkingReportsTable).values({
      userId: "unverified-student",
      garageId,
      availabilityStatus: "full",
    });

    const response = await request(app)
      .get(`/api/garages/${garageId}`)
      .expect(200);

    expect(response.body.availabilitySource).toBe("demo");
    expect(response.body.availableSpots).toBe(50);
  });

  it("does not expose a public mutation that can create trusted live availability", async () => {
    await request(app)
      .patch(`/api/garages/${garageId}/availability`)
      .send({ availableSpots: 31, totalSpots: 100 })
      .expect(404);

    const response = await request(app)
      .get(`/api/garages/${garageId}`)
      .expect(200);
    expect(response.body.availabilitySource).toBe("demo");
    expect(response.body.availableSpots).toBe(50);
  });
});