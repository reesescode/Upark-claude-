import { index, pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { parkingReportsTable } from "./parking-reports";
import { userProfilesTable } from "./user-profile";

export const parkingNoteFlagsTable = pgTable("parking_note_flags", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => parkingReportsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => userProfilesTable.userId, { onDelete: "cascade" }),
  reason: text("reason").notNull().default("inappropriate_or_false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("parking_note_flags_report_user_idx").on(table.reportId, table.userId),
  index("parking_note_flags_user_created_idx").on(table.userId, table.createdAt),
]);

export const insertParkingNoteFlagSchema = createInsertSchema(parkingNoteFlagsTable).omit({ id: true, createdAt: true });
export type InsertParkingNoteFlag = z.infer<typeof insertParkingNoteFlagSchema>;
export type ParkingNoteFlag = typeof parkingNoteFlagsTable.$inferSelect;
