import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { db, garagesTable, parkingContributionsTable as contributions, parkingReportsTable as reports, pool, userProfilesTable } from "@workspace/db";
import app from "../app";
import { campusDay, locationError, rewardLevel, similarStatus, summarizeRewards, TOO_FAR_MESSAGE } from "../lib/parking-rewards";

const prefix = `rewards-test-${randomUUID()}`;
const garageIds = [0, 1, 2].map((n) => `${prefix}-garage-${n}`);
const userIds = [0, 1, 2, 3].map((n) => `${prefix}-user-${n}`);
const location = () => ({ latitude: 26, longitude: -81, accuracy: 5, timestamp: Date.now() });
const submit = (userId: string, garageId = garageIds[0], availabilityStatus = "plenty_spots", coords = location()) =>
  request(app).post(`/api/garages/${garageId}/reports`).set("x-test-user-id", userId).send({ availabilityStatus, location: coords, userId: "forged-user" });
const stats = (id: string) => request(app).get("/api/rewards/me").set("x-test-user-id", id);

describe("location-verified parking rewards", () => {
  beforeAll(async () => {
    await db.insert(userProfilesTable).values(userIds.map((userId) => ({
      userId, authUserId: userId, displayName: "Private Full Name", firstName: "Casey", lastName: "SecretSurname",
    })));
    await db.insert(garagesTable).values(garageIds.map((id) => ({
      id, name: "Reward Test", shortName: "Test", address: "Test", type: "garage",
      availableSpots: 50, totalSpots: 100, distanceMiles: 1, driveTimeMinutes: 1, walkingTimeMinutes: 1,
      openHours: "24 hours", price: "Free", permits: ["student"], latitude: 26, longitude: -81,
    })));
  });
  afterAll(async () => {
    await db.delete(garagesTable).where(inArray(garagesTable.id, garageIds));
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.userId, userIds));
    await pool.end();
  });

  it("requires authentication and fresh accurate nearby GPS without awarding invalid reports", async () => {
    await request(app).post(`/api/garages/${garageIds[0]}/reports`).send({ availabilityStatus: "full", location: location() }).expect(401);
    await request(app).get("/api/rewards/me").expect(401);
    const far = await submit(userIds[0], garageIds[0], "full", { ...location(), latitude: 27 });
    expect(far.status).toBe(400);
    expect(far.body.error).toBe(TOO_FAR_MESSAGE);
    expect((await submit(userIds[0], garageIds[0], "full", { ...location(), timestamp: Date.now() - 120_000 })).status).toBe(400);
    expect((await submit(userIds[0], garageIds[0], "full", { ...location(), accuracy: 150 })).status).toBe(400);
    expect((await stats(userIds[0])).body.totalPoints).toBe(0);
  });

  it("awards10, uses server identity, rejects duplicate and self-confirmation", async () => {
    const first = await submit(userIds[0]);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ isVerified: true, pointsEarned: 10 });
    expect(Date.parse(first.body.expiresAt) - Date.parse(first.body.createdAt)).toBe(30 * 60_000);
    const [stored] = await db.select().from(reports).where(eq(reports.id, first.body.id));
    expect(stored.userId).toBe(userIds[0]);
    expect((await submit(userIds[0])).status).toBe(409);
    expect((await stats(userIds[0])).body).toMatchObject({ totalPoints: 10, validReports: 1, reportsRemainingToday: 1, currentStreak: 1 });
  });

  it("gives each rewarded matching report only one5-point bonus from other users", async () => {
    const second = await submit(userIds[1], garageIds[0], "filling_up");
    expect(second.body.pointsEarned).toBe(15);
    expect((await stats(userIds[0])).body.totalPoints).toBe(15);
    expect((await stats(userIds[1])).body.totalPoints).toBe(15);
    expect((await submit(userIds[2], garageIds[0], "plenty_spots")).body.pointsEarned).toBe(15);
    expect((await stats(userIds[0])).body.totalPoints).toBe(15);
  });

  it("enforces two rewards even with concurrent reports at different garages", async () => {
    const results = await Promise.all([submit(userIds[0], garageIds[1], "full"), submit(userIds[0], garageIds[2], "full")]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results.map((r) => r.body.pointsEarned).sort((a, b) => a - b)).toEqual([0, 10]);
    expect((await stats(userIds[0])).body).toMatchObject({ totalPoints: 25, validReports: 3, reportsRemainingToday: 0 });
  });

  it("keeps reward totals and duplicate prevention when visible history is cleared", async () => {
    await db.delete(reports).where(eq(reports.userId, userIds[0]));
    expect((await stats(userIds[0])).body.totalPoints).toBe(25);
    expect((await submit(userIds[0])).status).toBe(409);
  });

  it("does not confirm an expired report and retains its earned points", async () => {
    await db.update(contributions).set({ expiresAt: new Date(Date.now() - 1) }).where(and(eq(contributions.garageId, garageIds[1]), eq(contributions.userId, userIds[0])));
    const result = await submit(userIds[3], garageIds[1], "full");
    expect(result.body.pointsEarned).toBe(10);
    expect((await stats(userIds[0])).body.totalPoints).toBe(25);
  });

  it("exposes only first name and last initial, never profile IDs or emails", async () => {
    await db.update(contributions).set({ basePoints: 1000 }).where(eq(contributions.userId, userIds[3]));
    const result = await request(app).get("/api/rewards/leaderboard").expect(200);
    const entry = result.body.find((row: { name: string; totalPoints: number }) => row.name === "Casey S." && row.totalPoints === 1000);
    expect(entry).toBeDefined();
    expect(Object.keys(entry).sort()).toEqual(["rank", "name", "totalPoints", "validReports", "level"].sort());
    expect(JSON.stringify(result.body)).not.toContain("SecretSurname");
    expect(JSON.stringify(result.body)).not.toContain(prefix);
  });

  it("resets rewarded allowance at campus midnight, independent of browser timezone", async () => {
    await db.update(contributions).set({ rewardDay: "2020-01-01", expiresAt: new Date(Date.now() - 1) }).where(eq(contributions.userId, userIds[0]));
    expect((await stats(userIds[0])).body.reportsRemainingToday).toBe(2);
    expect((await submit(userIds[0], garageIds[0], "full")).body.pointsEarned).toBe(10);
  });
});

describe("reward calendar and levels", () => {
  it("handles midnight, DST, streaks and every achievement boundary", () => {
    expect(campusDay(new Date("2026-10-09T03:59:59Z"))).toBe("2026-10-08");
    expect(campusDay(new Date("2026-10-09T04:00:00Z"))).toBe("2026-10-09");
    expect([0, 49, 50, 149, 150, 299, 300].map(rewardLevel)).toEqual(["New Reporter", "New Reporter", "Campus Helper", "Campus Helper", "Parking Pro", "Parking Pro", "U Park MVP"]);
    const rows = ["2026-10-09", "2026-10-08", "2026-10-07"].map((rewardDay) => ({ rewardDay, basePoints: 10, bonusPoints: 0 })) as Parameters<typeof summarizeRewards>[0];
    expect(summarizeRewards(rows, new Date("2026-10-09T16:00:00Z"))).toMatchObject({ currentStreak: 3, resetsAt: "2026-10-10T04:00:00.000Z" });
    expect(summarizeRewards(rows, new Date("2026-10-10T16:00:00Z")).currentStreak).toBe(3);
    expect(summarizeRewards(rows, new Date("2026-10-11T16:00:00Z")).currentStreak).toBe(0);
    expect(summarizeRewards([], new Date("2026-11-01T04:00:00Z")).resetsAt).toBe("2026-11-02T05:00:00.000Z");
    expect(similarStatus("full", "almost_full")).toBe(true);
    expect(similarStatus("full", "plenty_spots")).toBe(false);
    expect(locationError({ ...location(), latitude: 26.0008 }, { latitude: 26, longitude: -81 }, new Date())).toBeNull();
    expect(locationError({ ...location(), latitude: 26.001 }, { latitude: 26, longitude: -81 }, new Date())).toBe(TOO_FAR_MESSAGE);
  });
});
