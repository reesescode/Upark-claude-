import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, garagesTable, parkingReportsTable, parkingNoteFlagsTable, parkingContributionsTable, pool, userProfilesTable } from "@workspace/db";
import app from "../app";
import { NOTE_BLOCKED_MESSAGE } from "../lib/parking-note-moderation";

const prefix = `notes-test-${randomUUID()}`;
const garageId = `${prefix}-garage`;
const users = [0, 1, 2].map((n) => `${prefix}-user-${n}`);
const submit = (note?: string, userId = users[0]) => request(app)
  .post(`/api/garages/${garageId}/reports`).set("x-test-user-id", userId)
  .send({ availabilityStatus: "plenty_spots", ...(note === undefined ? {} : { note }),
    location: { latitude: 26, longitude: -81, accuracy: 5, timestamp: Date.now() } });

describe("parking report notes", () => {
  beforeAll(async () => {
    await db.insert(userProfilesTable).values(users.map((userId) => ({ userId, authUserId: userId, displayName: "Note tester" })));
    await db.insert(garagesTable).values({
      id: garageId, name: "Note Test Garage", shortName: "NT", address: "Test",
      type: "garage", availableSpots: 40, totalSpots: 100, distanceMiles: 1,
      driveTimeMinutes: 2, walkingTimeMinutes: 5, openHours: "24 hours", price: "Free",
      permits: ["student"], latitude: 26, longitude: -81,
    });
  });
  afterAll(async () => {
    await db.delete(garagesTable).where(eq(garagesTable.id, garageId));
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.userId, users));
    await pool.end();
  });
  it("blocks invalid notes without saving a report or awarding points", async () => {
    for (const note of ["f u c k", "a".repeat(101), "239-555-1234", "free porn", "I will shoot you"]) {
      const response = await submit(note);
      expect(response.status).toBe(400);
      if (note.length <= 100) expect(response.body.error).toBe(NOTE_BLOCKED_MESSAGE);
    }
    expect(await db.select().from(parkingReportsTable).where(eq(parkingReportsTable.garageId, garageId))).toHaveLength(0);
    expect(await db.select().from(parkingContributionsTable).where(eq(parkingContributionsTable.garageId, garageId))).toHaveLength(0);
  });
  it("saves the optional note, preserves GPS/rewards, and exposes it in the feed", async () => {
    const note = "I’m leaving now, spot opening up near the stairs.";
    const created = await submit(note);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ note, isVerified: true, pointsEarned: 10, noteEmergency: false });
    const [stored] = await db.select().from(parkingReportsTable).where(eq(parkingReportsTable.id, created.body.id));
    expect(stored.note).toBe(note);
    const feed = await request(app).get(`/api/garages/${garageId}/reports`);
    expect(feed.body.find((row: { id: number }) => row.id === stored.id).note).toBe(note);
    const flagPath = `/api/garages/${garageId}/reports/${stored.id}/flag`;
    await request(app).post(flagPath).expect(401);
    await request(app).post(flagPath).set("x-test-user-id", users[0]).expect(403);
    await request(app).post(flagPath).set("x-test-user-id", users[1]).expect(200);
    await request(app).post(flagPath).set("x-test-user-id", users[1]).expect(200);
    expect(await db.select().from(parkingNoteFlagsTable).where(eq(parkingNoteFlagsTable.reportId, stored.id))).toHaveLength(1);
    // A flag is review evidence, not authority to delete a report or change points.
    expect((await request(app).get(`/api/garages/${garageId}/reports`)).body).toHaveLength(1);
    await db.update(parkingReportsTable).set({ createdAt: new Date(Date.now() - 31 * 60_000) }).where(eq(parkingReportsTable.id, stored.id));
    expect((await request(app).get(`/api/garages/${garageId}/reports`)).body).toHaveLength(0);
    await request(app).post(flagPath).set("x-test-user-id", users[2]).expect(404);
  });
  it("accepts status-only reports and labels emergency notes without verifying their claims", async () => {
    const blank = await submit(undefined, users[1]);
    expect(blank.status).toBe(201);
    expect(blank.body.note).toBeNull();
    await request(app).post(`/api/garages/${garageId}/reports/${blank.body.id}/flag`).set("x-test-user-id", users[0]).expect(404);
    const emergency = await submit("Fire near the garage entrance.", users[2]);
    expect(emergency.status).toBe(201);
    expect(emergency.body).toMatchObject({ note: "Fire near the garage entrance.", noteEmergency: true });
  });
});
