import { date, doublePrecision, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { parkingAvailabilityStatusEnum } from "./parking-reports";
import { userProfilesTable } from "./user-profile";

// Independent of visible report history: clearing history must not reset rewards.
export const parkingContributionsTable = pgTable("parking_contributions", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().unique(),
  userId: text("user_id").notNull().references(() => userProfilesTable.userId, { onDelete: "cascade" }),
  garageId: text("garage_id").notNull(),
  availabilityStatus: parkingAvailabilityStatusEnum("availability_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  rewardDay: date("reward_day", { mode: "string" }).notNull(),
  basePoints: integer("base_points").notNull(),
  bonusPoints: integer("bonus_points").notNull().default(0),
  confirmedByUserId: text("confirmed_by_user_id"),
  distanceMeters: doublePrecision("distance_meters").notNull(),
  accuracyMeters: doublePrecision("accuracy_meters").notNull(),
}, (table) => [
  index("contributions_user_day_idx").on(table.userId, table.rewardDay),
  index("contributions_garage_expiry_idx").on(table.garageId, table.expiresAt),
]);

export const insertParkingContributionSchema = createInsertSchema(parkingContributionsTable).omit({ id: true });
export type ParkingContribution = typeof parkingContributionsTable.$inferSelect;
