import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const garagesTable = pgTable("garages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  address: text("address").notNull(),
  type: text("type").notNull(),
  availableSpots: integer("available_spots").notNull(),
  availabilityUpdatedAt: timestamp("availability_updated_at", {
    withTimezone: true,
  }),
  totalSpots: integer("total_spots").notNull(),
  distanceMiles: doublePrecision("distance_miles").notNull(),
  driveTimeMinutes: integer("drive_time_minutes").notNull(),
  walkingTimeMinutes: integer("walking_time_minutes").notNull(),
  openHours: text("open_hours").notNull(),
  price: text("price").notNull(),
  permits: text("permits").array().notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGarageSchema = createInsertSchema(garagesTable).omit({
  updatedAt: true,
});
export type InsertGarage = z.infer<typeof insertGarageSchema>;
export type GarageRecord = typeof garagesTable.$inferSelect;