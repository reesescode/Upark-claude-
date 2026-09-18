import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  notificationSettingsTable,
  parkingReportsTable,
  pool,
  supportRequestsTable,
  userFavoritesTable,
  userPreferencesTable,
  userProfilesTable,
} from "@workspace/db";
import app from "../app";

const deletedUserId = `profile-delete-${randomUUID()}`;
const retainedUserId = `profile-retain-${randomUUID()}`;
const garageId = "north-deck";

async function createPopulatedProfile(userId: string) {
  await request(app)
    .put(`/api/users/${userId}/profile`)
    .send({ displayName: `Profile ${userId}` })
    .expect(200);
  await request(app)
    .put(`/api/users/${userId}/preferences`)
    .send({
      defaultParkingPreference: "most_available",
      defaultCampus: "FGCU",
      distanceUnits: "kilometers",
      autoUseLocation: true,
      favoriteGarageId: garageId,
      locationServices: true,
      anonymousDataCollection: true,
    })
    .expect(200);
  await request(app)
    .put(`/api/users/${userId}/notifications`)
    .send({
      garageAlmostFullAlerts: false,
      favoriteGarageAlerts: true,
      parkingAvailabilityUpdates: true,
      uparkAnnouncements: true,
      notificationSound: false,
    })
    .expect(200);
  await request(app)
    .put(`/api/users/${userId}/favorites`)
    .send({ garageIds: [garageId] })
    .expect(200);
  await request(app)
    .post(`/api/users/${userId}/support-requests`)
    .send({
      category: "feedback",
      subject: "Deletion test",
      message: "This request verifies scoped account deletion.",
    })
    .expect(201);
  await db.insert(parkingReportsTable).values({
    userId,
    garageId,
    availabilityStatus: "plenty_spots",
  });
}

describe("profile account deletion", () => {
  afterAll(async () => {
    await db
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.userId, deletedUserId));
    await db
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.userId, retainedUserId));
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.userId, deletedUserId));
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.userId, retainedUserId));
    await pool.end();
  });

  it("removes one user's data without affecting another user", async () => {
    await createPopulatedProfile(deletedUserId);
    await createPopulatedProfile(retainedUserId);

    await request(app)
      .delete(`/api/users/${deletedUserId}/profile`)
      .expect(204);

    const deletedRows = await Promise.all([
      db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, deletedUserId)),
      db
        .select()
        .from(userPreferencesTable)
        .where(eq(userPreferencesTable.userId, deletedUserId)),
      db
        .select()
        .from(notificationSettingsTable)
        .where(eq(notificationSettingsTable.userId, deletedUserId)),
      db
        .select()
        .from(userFavoritesTable)
        .where(eq(userFavoritesTable.userId, deletedUserId)),
      db
        .select()
        .from(supportRequestsTable)
        .where(eq(supportRequestsTable.userId, deletedUserId)),
      db
        .select()
        .from(parkingReportsTable)
        .where(eq(parkingReportsTable.userId, deletedUserId)),
    ]);
    expect(deletedRows.every((rows) => rows.length === 0)).toBe(true);

    const retainedRows = await Promise.all([
      db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, retainedUserId)),
      db
        .select()
        .from(userPreferencesTable)
        .where(eq(userPreferencesTable.userId, retainedUserId)),
      db
        .select()
        .from(notificationSettingsTable)
        .where(eq(notificationSettingsTable.userId, retainedUserId)),
      db
        .select()
        .from(userFavoritesTable)
        .where(eq(userFavoritesTable.userId, retainedUserId)),
      db
        .select()
        .from(supportRequestsTable)
        .where(eq(supportRequestsTable.userId, retainedUserId)),
      db
        .select()
        .from(parkingReportsTable)
        .where(eq(parkingReportsTable.userId, retainedUserId)),
    ]);
    expect(retainedRows.every((rows) => rows.length === 1)).toBe(true);
  });
});