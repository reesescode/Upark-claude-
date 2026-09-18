import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { clerkClient, getAuth } from "@clerk/express";
import {
  db,
  garagesTable,
  notificationSettingsTable,
  parkingReportsTable,
  supportRequestsTable,
  userFavoritesTable,
  userPreferencesTable,
  userProfilesTable,
} from "@workspace/db";
import {
  ClearUserParkingHistoryParams,
  CreateSupportRequestBody,
  CreateSupportRequestParams,
  CreateSupportRequestResponse,
  DeleteUserAccountParams,
  GetUserProfileParams,
  GetUserProfileResponse,
  UpdateNotificationSettingsBody,
  UpdateNotificationSettingsParams,
  UpdateNotificationSettingsResponse,
  UpdateUserFavoritesBody,
  UpdateUserFavoritesParams,
  UpdateUserFavoritesResponse,
  UpdateUserPreferencesBody,
  UpdateUserPreferencesParams,
  UpdateUserPreferencesResponse,
  UpsertUserProfileBody,
  UpsertUserProfileParams,
  UpsertUserProfileResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use("/users/:userId", (req, res, next) => {
  const authUserId =
    process.env.NODE_ENV === "test"
      ? req.header("x-test-user-id")
      : getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (authUserId !== req.params.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

async function ensureUser(userId: string) {
  const [profile] = await db
    .select({
      authUserId: userProfilesTable.authUserId,
      firstName: userProfilesTable.firstName,
      lastName: userProfilesTable.lastName,
      email: userProfilesTable.email,
      university: userProfilesTable.university,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (
    !profile ||
    profile.authUserId !== userId ||
    !profile.firstName ||
    !profile.lastName ||
    !profile.email ||
    !profile.university
  ) {
    return false;
  }
  await Promise.all([
    db
      .insert(userPreferencesTable)
      .values({ userId })
      .onConflictDoNothing(),
    db
      .insert(notificationSettingsTable)
      .values({ userId })
      .onConflictDoNothing(),
  ]);
  return true;
}

function toPreferences(record: typeof userPreferencesTable.$inferSelect) {
  return {
    defaultParkingPreference:
      record.defaultParkingPreference === "most_available" ||
      record.defaultParkingPreference === "lowest_occupancy"
        ? record.defaultParkingPreference
        : ("closest" as const),
    defaultCampus: record.defaultCampus,
    distanceUnits:
      record.distanceUnits === "kilometers"
        ? ("kilometers" as const)
        : ("miles" as const),
    autoUseLocation: record.autoUseLocation,
    favoriteGarageId: record.favoriteGarageId,
    locationServices: record.locationServices,
    anonymousDataCollection: record.anonymousDataCollection,
  };
}

function toNotifications(record: typeof notificationSettingsTable.$inferSelect) {
  return {
    garageAlmostFullAlerts: record.garageAlmostFullAlerts,
    favoriteGarageAlerts: record.favoriteGarageAlerts,
    parkingAvailabilityUpdates: record.parkingAvailabilityUpdates,
    uparkAnnouncements: record.uparkAnnouncements,
    notificationSound: record.notificationSound,
  };
}

function toParkingReport(record: typeof parkingReportsTable.$inferSelect) {
  return {
    id: record.id,
    garageId: record.garageId,
    availabilityStatus: record.availabilityStatus,
    createdAt: record.createdAt.toISOString(),
    isVerified: record.isVerified,
  };
}

async function getProfileData(userId: string) {
  const [[profile], [preferences], [notifications], favorites, reports] =
    await Promise.all([
      db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId)),
      db
        .select()
        .from(userPreferencesTable)
        .where(eq(userPreferencesTable.userId, userId)),
      db
        .select()
        .from(notificationSettingsTable)
        .where(eq(notificationSettingsTable.userId, userId)),
      db
        .select({ garageId: userFavoritesTable.garageId })
        .from(userFavoritesTable)
        .where(eq(userFavoritesTable.userId, userId)),
      db
        .select()
        .from(parkingReportsTable)
        .where(eq(parkingReportsTable.userId, userId))
        .orderBy(desc(parkingReportsTable.createdAt))
        .limit(100),
    ]);

  if (!profile || profile.id === null || !preferences || !notifications) return null;
  return {
    id: profile.id,
    userId: profile.userId,
    authUserId: profile.authUserId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    university: profile.university,
    displayName: profile.displayName,
    preferences: toPreferences(preferences),
    notifications: toNotifications(notifications),
    favoriteGarageIds: favorites.map((favorite) => favorite.garageId),
    parkingReports: reports.map(toParkingReport),
  };
}

router.get("/users/:userId/profile", async (req, res): Promise<void> => {
  const params = GetUserProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const data = await getProfileData(params.data.userId);
  if (!data) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetUserProfileResponse.parse(data));
});

router.put("/users/:userId/profile", async (req, res): Promise<void> => {
  const params = UpsertUserProfileParams.safeParse(req.params);
  const body = UpsertUserProfileBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid profile" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(userProfilesTable)
      .values({
        userId: params.data.userId,
        authUserId: params.data.userId,
        firstName: body.data.firstName.trim(),
        lastName: body.data.lastName.trim(),
        email: body.data.email.trim().toLowerCase(),
        university: body.data.university.trim(),
        displayName: `${body.data.firstName} ${body.data.lastName}`.trim(),
      })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: {
          authUserId: params.data.userId,
          firstName: body.data.firstName.trim(),
          lastName: body.data.lastName.trim(),
          email: body.data.email.trim().toLowerCase(),
          university: body.data.university.trim(),
          displayName: `${body.data.firstName} ${body.data.lastName}`.trim(),
          updatedAt: new Date(),
        },
      });
    await tx
      .insert(userPreferencesTable)
      .values({ userId: params.data.userId })
      .onConflictDoNothing();
    await tx
      .insert(notificationSettingsTable)
      .values({ userId: params.data.userId })
      .onConflictDoNothing();
  });
  const data = await getProfileData(params.data.userId);
  res.json(UpsertUserProfileResponse.parse(data));
});

router.put("/users/:userId/preferences", async (req, res): Promise<void> => {
  const params = UpdateUserPreferencesParams.safeParse(req.params);
  const body = UpdateUserPreferencesBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid preferences" });
    return;
  }
  if (!(await ensureUser(params.data.userId))) {
    res.status(404).json({ error: "Complete profile not found" });
    return;
  }
  const [record] = await db
    .insert(userPreferencesTable)
    .values({ userId: params.data.userId, ...body.data })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      set: { ...body.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateUserPreferencesResponse.parse(toPreferences(record)));
});

router.put("/users/:userId/notifications", async (req, res): Promise<void> => {
  const params = UpdateNotificationSettingsParams.safeParse(req.params);
  const body = UpdateNotificationSettingsBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid notification settings" });
    return;
  }
  if (!(await ensureUser(params.data.userId))) {
    res.status(404).json({ error: "Complete profile not found" });
    return;
  }
  const [record] = await db
    .insert(notificationSettingsTable)
    .values({ userId: params.data.userId, ...body.data })
    .onConflictDoUpdate({
      target: notificationSettingsTable.userId,
      set: { ...body.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateNotificationSettingsResponse.parse(toNotifications(record)));
});

router.put("/users/:userId/favorites", async (req, res): Promise<void> => {
  const params = UpdateUserFavoritesParams.safeParse(req.params);
  const body = UpdateUserFavoritesBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid favorites" });
    return;
  }
  if (!(await ensureUser(params.data.userId))) {
    res.status(404).json({ error: "Complete profile not found" });
    return;
  }
  const uniqueIds = [...new Set(body.data.garageIds)];
  if (uniqueIds.length) {
    const valid = await db
      .select({ id: garagesTable.id })
      .from(garagesTable)
      .where(inArray(garagesTable.id, uniqueIds));
    if (valid.length !== uniqueIds.length) {
      res.status(400).json({ error: "One or more parking locations are invalid" });
      return;
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(userFavoritesTable)
      .where(eq(userFavoritesTable.userId, params.data.userId));
    if (uniqueIds.length) {
      await tx
        .insert(userFavoritesTable)
        .values(uniqueIds.map((garageId) => ({ userId: params.data.userId, garageId })));
    }
  });
  res.json(UpdateUserFavoritesResponse.parse(uniqueIds));
});

router.delete("/users/:userId/parking-history", async (req, res): Promise<void> => {
  const params = ClearUserParkingHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(parkingReportsTable)
    .where(eq(parkingReportsTable.userId, params.data.userId));
  res.status(204).end();
});

router.delete("/users/:userId/profile", async (req, res): Promise<void> => {
  const params = DeleteUserAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(parkingReportsTable)
      .where(eq(parkingReportsTable.userId, params.data.userId));
    await tx
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.userId, params.data.userId));
  });
  await clerkClient.users.deleteUser(params.data.userId);
  res.status(204).end();
});

router.post("/users/:userId/support-requests", async (req, res): Promise<void> => {
  const params = CreateSupportRequestParams.safeParse(req.params);
  const body = CreateSupportRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid support request" });
    return;
  }
  const bugDescription = body.data.bugDescription?.trim() || null;
  if (body.data.encounteredBug && !bugDescription) {
    res.status(400).json({ error: "Please describe the bug you encountered" });
    return;
  }
  if (!(await ensureUser(params.data.userId))) {
    res.status(404).json({ error: "Complete profile not found" });
    return;
  }
  const [record] = await db
    .insert(supportRequestsTable)
    .values({
      userId: params.data.userId,
      ...body.data,
      bugDescription: body.data.encounteredBug ? bugDescription : null,
    })
    .returning();
  res.status(201).json(
    CreateSupportRequestResponse.parse({
      id: record.id,
      category: record.category,
      subject: record.subject,
      message: record.message,
      encounteredBug: record.encounteredBug,
      bugDescription: record.bugDescription,
      wouldRecommend: record.wouldRecommend,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    }),
  );
});

export default router;