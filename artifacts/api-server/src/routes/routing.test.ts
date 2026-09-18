import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, garagesTable, pool } from "@workspace/db";
import app from "../app";
import { resetRoutingStateForTests } from "../lib/routing";
import {
  consumeRouteQuota,
  resetRouteQuotaForTests,
} from "./routing";

const garageId = `routing-test-${randomUUID()}`;

describe("campus routing", () => {
  beforeAll(async () => {
    await db.insert(garagesTable).values({
      id: garageId,
      name: "Routing Test Garage",
      shortName: "Route Test",
      address: "1 Route Way",
      type: "garage",
      availableSpots: 50,
      totalSpots: 100,
      distanceMiles: 0.5,
      driveTimeMinutes: 2,
      walkingTimeMinutes: 5,
      openHours: "24 hours",
      price: "Free",
      permits: ["student"],
      latitude: 26.4647786,
      longitude: -81.7762832,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetRoutingStateForTests();
    resetRouteQuotaForTests();
  });

  afterAll(async () => {
    await db.delete(garagesTable).where(eq(garagesTable.id, garageId));
    await pool.end();
  });

  it("returns an app-owned route and caches nearby repeated requests", async () => {
    const providerFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: "Ok",
        routes: [{
          distance: 2200,
          duration: 360,
          geometry: {
            coordinates: [
              [-81.79, 26.45],
              [-81.7762832, 26.4647786],
            ],
          },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", providerFetch);

    const first = await request(app)
      .post(`/api/garages/${garageId}/route`)
      .send({ originLat: 26.45, originLng: -81.79 })
      .expect(200);
    const second = await request(app)
      .post(`/api/garages/${garageId}/route`)
      .send({ originLat: 26.45001, originLng: -81.79001 })
      .expect(200);

    expect(first.body).toEqual({
      distanceMeters: 2200,
      durationSeconds: 360,
      coordinates: [
        [26.45, -81.79],
        [26.4647786, -81.7762832],
      ],
    });
    expect(second.body).toEqual(first.body);
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("returns stable errors for invalid requests and provider failures", async () => {
    const invalid = await request(app)
      .post(`/api/garages/${garageId}/route`)
      .send({ originLat: 120, originLng: -81.79 })
      .expect(400);
    expect(invalid.body).toEqual({
      error: "Origin coordinates are invalid.",
      code: "INVALID_ROUTE_REQUEST",
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    const unavailable = await request(app)
      .post(`/api/garages/${garageId}/route`)
      .send({ originLat: 26.45, originLng: -81.79 })
      .expect(503);
    expect(unavailable.body).toEqual({
      error: "A driving route is temporarily unavailable.",
      code: "ROUTE_UNAVAILABLE",
    });
  });

  it("keeps proxied clients on independent quotas and returns retry timing", async () => {
    const providerFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: "Ok",
        routes: [{
          distance: 2200,
          duration: 360,
          geometry: {
            coordinates: [
              [-81.79, 26.45],
              [-81.7762832, 26.4647786],
            ],
          },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", providerFetch);

    const now = Date.now();
    for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
      expect(consumeRouteQuota("203.0.113.10", now)).toBeNull();
    }

    const limited = await request(app)
      .post(`/api/garages/${garageId}/route`)
      .set("X-Forwarded-For", "203.0.113.10")
      .send({ originLat: 26.45, originLng: -81.79 })
      .expect(429);
    expect(limited.headers["retry-after"]).toBe("60");
    expect(limited.body).toEqual({
      error: "Too many route requests. Please try again shortly.",
      code: "ROUTE_RATE_LIMITED",
    });

    await request(app)
      .post(`/api/garages/${garageId}/route`)
      .set("X-Forwarded-For", "203.0.113.11")
      .send({ originLat: 26.45, originLng: -81.79 })
      .expect(200);
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });
});