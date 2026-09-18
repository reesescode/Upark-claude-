import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { garagesTable } from "./garages";

export const parkingObservationsTable = pgTable(
  "parking_observations",
  {
    id: serial("id").primaryKey(),
    garageId: text("garage_id")
      .notNull()
      .references(() => garagesTable.id, { onDelete: "cascade" }),
    availableSpots: integer("available_spots").notNull(),
    totalSpots: integer("total_spots").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    precedingEstimateSpots: integer("preceding_estimate_spots"),
    precedingEstimateSource: text("preceding_estimate_source").notNull(),
    precedingEstimateConfidence: text(
      "preceding_estimate_confidence",
    ).notNull(),
    precedingReportCount: integer("preceding_report_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("parking_observations_garage_observed_idx").on(
      table.garageId,
      table.observedAt,
    ),
    index("parking_observations_calibration_idx").on(
      table.garageId,
      table.observedAt,
    ),
  ],
);

export const insertParkingObservationSchema = createInsertSchema(
  parkingObservationsTable,
).omit({ id: true, createdAt: true });
export type InsertParkingObservation = z.infer<
  typeof insertParkingObservationSchema
>;
export type ParkingObservationRecord =
  typeof parkingObservationsTable.$inferSelect;