import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
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
const sparseUserId = `profile-sparse-${randomUUID()}`;
const garageId = "north-deck";
const deleteAuthUser = vi.spyOn(clerkClient.users, "deleteUser");

async function createPopulatedProfile(userId: string) {
  await request(app)
    .put(`/api/users/${userId}/profile`)
    .set("x-test-user-id", userId)
    .send({
      firstName: "Profile",
      lastName: userId,
      email: `${userId}@example.edu`,
      university: "Florida Gulf Coast University",
    })
    .expect(200);
  await request(app)
    .put(`/api/users/${userId}/preferences`)
    .set("x-test-user-id", userId)
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
    .set("x-test-user-id", userId)
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
    .set("x-test-user-id", userId)
    .send({ garageIds: [garageId] })
    .expect(200);
  await request(app)
    .post(`/api/users/${userId}/support-requests`)
    .set("x-test-user-id", userId)
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
  beforeAll(() => {
    deleteAuthUser.mockResolvedValue({} as never);
  });

  afterAll(async () => {
    deleteAuthUser.mockRestore();
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
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.userId, sparseUserId));
    await pool.end();
  });

  it("removes one user's data without affecting another user", async () => {
    await createPopulatedProfile(deletedUserId);
    await createPopulatedProfile(retainedUserId);

    await request(app)
      .delete(`/api/users/${deletedUserId}/profile`)
      .set("x-test-user-id", deletedUserId)
      .expect(204);
    expect(deleteAuthUser).toHaveBeenCalledWith(deletedUserId);

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

  it("rejects missing and mismatched authenticated identities", async () => {
    await request(app)
      .get(`/api/users/${retainedUserId}/profile`)
      .expect(401);
    await request(app)
      .get(`/api/users/${retainedUserId}/profile`)
      .set("x-test-user-id", "different-user")
      .expect(403);
  });

  it("does not create defaults for an incomplete placeholder profile", async () => {
    await db.insert(userProfilesTable).values({
      userId: sparseUserId,
      authUserId: sparseUserId,
      displayName: "Incomplete",
    });

    await request(app)
      .put(`/api/users/${sparseUserId}/preferences`)
      .set("x-test-user-id", sparseUserId)
      .send({
        defaultParkingPreference: "closest",
        defaultCampus: "FGCU",
        distanceUnits: "miles",
        autoUseLocation: false,
        favoriteGarageId: null,
        locationServices: true,
        anonymousDataCollection: false,
      })
      .expect(404);

    const defaults = await db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, sparseUserId));
    expect(defaults).toHaveLength(0);
  });
});