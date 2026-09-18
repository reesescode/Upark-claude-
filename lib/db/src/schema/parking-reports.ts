import {
  pgEnum,
  index,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { garagesTable } from "./garages";

export const parkingAvailabilityStatusEnum = pgEnum(
  "parking_availability_status",
  ["plenty_spots", "filling_up", "almost_full", "full"],
);

export const parkingReportsTable = pgTable(
  "parking_reports",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    garageId: text("garage_id")
      .notNull()
      .references(() => garagesTable.id, { onDelete: "cascade" }),
    availabilityStatus: parkingAvailabilityStatusEnum(
      "availability_status",
    ).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("parking_reports_user_garage_created_idx").on(
      table.userId,
      table.garageId,
      table.createdAt,
    ),
  ],
);

export const insertParkingReportSchema = createInsertSchema(
  parkingReportsTable,
).omit({ id: true, createdAt: true });
export type InsertParkingReport = z.infer<typeof insertParkingReportSchema>;
export type ParkingReportRecord = typeof parkingReportsTable.$inferSelect;