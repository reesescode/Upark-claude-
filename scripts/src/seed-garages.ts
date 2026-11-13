// Seeds a local database with the FGCU garages and lots UPARK knows about.
// IDs must match getGarageIdForOfficialLocation (Parking Garages 1–4) and
// isReportOnlyLot in the API server. Capacities and coordinates are
// approximate dev values; the live feed overwrites garage counts on sync.
import { db, garagesTable, pool, type InsertGarage } from "@workspace/db";

const garages: InsertGarage[] = [
  {
    id: "north-deck",
    name: "Parking Garage 1",
    shortName: "PG1",
    address: "North Lake Village, FGCU, Fort Myers, FL 33965",
    type: "garage",
    availableSpots: 600,
    totalSpots: 1200,
    distanceMiles: 0.4,
    driveTimeMinutes: 2,
    walkingTimeMinutes: 8,
    openHours: "24 hours",
    price: "Permit required",
    permits: ["student", "faculty"],
    latitude: 26.4668,
    longitude: -81.7745,
  },
  {
    id: "science-center",
    name: "Parking Garage 2",
    shortName: "PG2",
    address: "Library Ln, FGCU, Fort Myers, FL 33965",
    type: "garage",
    availableSpots: 450,
    totalSpots: 900,
    distanceMiles: 0.3,
    driveTimeMinutes: 2,
    walkingTimeMinutes: 6,
    openHours: "24 hours",
    price: "Permit required",
    permits: ["student", "faculty"],
    latitude: 26.4641,
    longitude: -81.7702,
  },
  {
    id: "library-garage",
    name: "Parking Garage 3",
    shortName: "PG3",
    address: "Library Ln, FGCU, Fort Myers, FL 33965",
    type: "garage",
    availableSpots: 500,
    totalSpots: 1000,
    distanceMiles: 0.2,
    driveTimeMinutes: 1,
    walkingTimeMinutes: 4,
    openHours: "24 hours",
    price: "Permit required",
    permits: ["student", "faculty"],
    latitude: 26.4619,
    longitude: -81.7748,
  },
  {
    id: "arts-garage",
    name: "Parking Garage 4",
    shortName: "PG4",
    address: "Arts Way, FGCU, Fort Myers, FL 33965",
    type: "garage",
    availableSpots: 400,
    totalSpots: 800,
    distanceMiles: 0.5,
    driveTimeMinutes: 3,
    walkingTimeMinutes: 9,
    openHours: "24 hours",
    price: "Permit required",
    permits: ["student", "faculty"],
    latitude: 26.4597,
    longitude: -81.7716,
  },
  {
    id: "stadium-lot",
    name: "Parking Lot P6 (Stadium)",
    shortName: "P6",
    address: "FGCU Blvd S, Fort Myers, FL 33965",
    type: "lot",
    availableSpots: 300,
    totalSpots: 600,
    distanceMiles: 0.9,
    driveTimeMinutes: 4,
    walkingTimeMinutes: 15,
    openHours: "24 hours",
    price: "Permit required",
    permits: ["student"],
    latitude: 26.4573,
    longitude: -81.7790,
  },
  {
    id: "east-lot",
    name: "Parking Lot P7 (East)",
    shortName: "P7",
    address: "FGCU Blvd N, Fort Myers, FL 33965",
    type: "lot",
    availableSpots: 250,
    totalSpots: 500,
    distanceMiles: 0.7,
    driveTimeMinutes: 3,
    walkingTimeMinutes: 12,
    openHours: "24 hours",
    price: "Permit required",
    permits: ["student"],
    latitude: 26.4630,
    longitude: -81.7660,
  },
  {
    id: "fgcu-lot-8",
    name: "Parking Lot P8",
    shortName: "P8",
    address: "FGCU Blvd S, Fort Myers, FL 33965",
    type: "lot",
    availableSpots: 200,
    totalSpots: 400,
    distanceMiles: 0.8,
    driveTimeMinutes: 4,
    walkingTimeMinutes: 14,
    openHours: "24 hours",
    price: "Permit required",
    permits: ["student"],
    latitude: 26.4590,
    longitude: -81.7765,
  },
];

// Never touch existing rows: re-running is safe and keeps live-feed values.
const inserted = await db
  .insert(garagesTable)
  .values(garages)
  .onConflictDoNothing()
  .returning({ id: garagesTable.id });

console.log(
  `Seeded ${inserted.length} of ${garages.length} garages` +
    (inserted.length < garages.length ? " (others already existed)" : ""),
);

await pool.end();
