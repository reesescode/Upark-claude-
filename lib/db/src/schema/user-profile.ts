import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { garagesTable } from "./garages";

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  id: serial("id").notNull().unique(),
  authUserId: text("auth_user_id").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  university: text("university"),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferencesTable = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => userProfilesTable.userId, { onDelete: "cascade" }),
  defaultParkingPreference: text("default_parking_preference")
    .notNull()
    .default("closest"),
  defaultCampus: text("default_campus").notNull().default("FGCU"),
  distanceUnits: text("distance_units").notNull().default("miles"),
  autoUseLocation: boolean("auto_use_location").notNull().default(false),
  favoriteGarageId: text("favorite_garage_id").references(() => garagesTable.id, {
    onDelete: "set null",
  }),
  locationServices: boolean("location_services").notNull().default(true),
  anonymousDataCollection: boolean("anonymous_data_collection")
    .notNull()
    .default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationSettingsTable = pgTable("notification_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => userProfilesTable.userId, { onDelete: "cascade" }),
  garageAlmostFullAlerts: boolean("garage_almost_full_alerts")
    .notNull()
    .default(true),
  favoriteGarageAlerts: boolean("favorite_garage_alerts")
    .notNull()
    .default(true),
  parkingAvailabilityUpdates: boolean("parking_availability_updates")
    .notNull()
    .default(true),
  uparkAnnouncements: boolean("upark_announcements").notNull().default(true),
  notificationSound: boolean("notification_sound").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userFavoritesTable = pgTable(
  "user_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfilesTable.userId, { onDelete: "cascade" }),
    garageId: text("garage_id")
      .notNull()
      .references(() => garagesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.garageId] })],
);

export const supportRequestsTable = pgTable(
  "support_requests",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfilesTable.userId, { onDelete: "cascade" }),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("support_requests_user_created_idx").on(table.userId, table.createdAt)],
);

export type UserProfileRecord = typeof userProfilesTable.$inferSelect;
export type UserPreferencesRecord = typeof userPreferencesTable.$inferSelect;
export type NotificationSettingsRecord = typeof notificationSettingsTable.$inferSelect;
export type SupportRequestRecord = typeof supportRequestsTable.$inferSelect;