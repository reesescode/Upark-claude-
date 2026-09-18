import { Router, type IRouter } from "express";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  garagesTable,
  parkingReportsTable,
  type GarageRecord,
  type ParkingReportRecord,
} from "@workspace/db";
import {
  CreateParkingReportBody,
  CreateParkingReportParams,
  CreateParkingReportResponse,
  GetCampusSummaryResponse,
  GetGarageParams,
  GetGarageResponse,
  ListParkingReportsParams,
  ListParkingReportsResponse,
  ListGaragesQueryParams,
  ListGaragesResponse,
  UpdateGarageAvailabilityBody,
  UpdateGarageAvailabilityParams,
  UpdateGarageAvailabilityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toGarage(record: GarageRecord) {
  const occupancyPercent = Math.round(
    ((record.totalSpots - record.availableSpots) / record.totalSpots) * 100,
  );
  const status =
    occupancyPercent >= 90
      ? ("nearly_full" as const)
      : occupancyPercent >= 70
        ? ("filling_up" as const)
        : ("open" as const);

  return {
    ...record,
    type: record.type === "lot" ? ("lot" as const) : ("garage" as const),
    occupancyPercent,
    status,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toParkingReport(record: ParkingReportRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
  };
}

router.get("/garages", async (req, res): Promise<void> => {
  const query = ListGaragesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const search = query.data.search?.trim();
  const where = search
    ? or(
        ilike(garagesTable.name, `%${search}%`),
        ilike(garagesTable.address, `%${search}%`),
      )
    : undefined;

  const occupancy = sql<number>`((${garagesTable.totalSpots} - ${garagesTable.availableSpots})::float / ${garagesTable.totalSpots})`;
  const order =
    query.data.sort === "most_available"
      ? desc(garagesTable.availableSpots)
      : query.data.sort === "least_full"
        ? asc(occupancy)
        : asc(garagesTable.distanceMiles);

  const records = await db.select().from(garagesTable).where(where).orderBy(order);
  res.json(ListGaragesResponse.parse(records.map(toGarage)));
});

router.get("/garages/:garageId", async (req, res): Promise<void> => {
  const params = GetGarageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .select()
    .from(garagesTable)
    .where(eq(garagesTable.id, params.data.garageId));

  if (!record) {
    res.status(404).json({ error: "Garage not found" });
    return;
  }
  res.json(GetGarageResponse.parse(toGarage(record)));
});

router.patch(
  "/garages/:garageId/availability",
  async (req, res): Promise<void> => {
    const params = UpdateGarageAvailabilityParams.safeParse(req.params);
    const body = UpdateGarageAvailabilityBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    if (body.data.availableSpots > body.data.totalSpots) {
      res.status(400).json({ error: "Available spots cannot exceed capacity" });
      return;
    }

    const [record] = await db
      .update(garagesTable)
      .set({
        availableSpots: body.data.availableSpots,
        totalSpots: body.data.totalSpots,
        updatedAt: new Date(),
      })
      .where(eq(garagesTable.id, params.data.garageId))
      .returning();

    if (!record) {
      res.status(404).json({ error: "Garage not found" });
      return;
    }
    res.json(UpdateGarageAvailabilityResponse.parse(toGarage(record)));
  },
);

router.get("/garages/:garageId/reports", async (req, res): Promise<void> => {
  const params = ListParkingReportsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [garage] = await db
    .select({ id: garagesTable.id })
    .from(garagesTable)
    .where(eq(garagesTable.id, params.data.garageId));

  if (!garage) {
    res.status(404).json({ error: "Garage not found" });
    return;
  }

  const reports = await db
    .select()
    .from(parkingReportsTable)
    .where(eq(parkingReportsTable.garageId, params.data.garageId))
    .orderBy(
      desc(parkingReportsTable.createdAt),
      desc(parkingReportsTable.id),
    )
    .limit(20);

  res.json(ListParkingReportsResponse.parse(reports.map(toParkingReport)));
});

router.post("/garages/:garageId/reports", async (req, res): Promise<void> => {
  const params = CreateParkingReportParams.safeParse(req.params);
  const body = CreateParkingReportBody.safeParse(req.body);

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [garage] = await db
    .select({ id: garagesTable.id })
    .from(garagesTable)
    .where(eq(garagesTable.id, params.data.garageId));

  if (!garage) {
    res.status(404).json({ error: "Garage not found" });
    return;
  }

  const [report] = await db
    .insert(parkingReportsTable)
    .values({
      userId: body.data.userId,
      garageId: params.data.garageId,
      availabilityStatus: body.data.availabilityStatus,
    })
    .returning();

  res
    .status(201)
    .json(CreateParkingReportResponse.parse(toParkingReport(report)));
});

router.get("/campus/summary", async (_req, res): Promise<void> => {
  const [summary] = await db
    .select({
      openSpots: sql<number>`coalesce(sum(${garagesTable.availableSpots}), 0)::int`,
      totalSpots: sql<number>`coalesce(sum(${garagesTable.totalSpots}), 0)::int`,
      garagesCount: sql<number>`count(*)::int`,
      lastUpdatedAt: sql<string>`coalesce(max(${garagesTable.updatedAt}), now())::text`,
    })
    .from(garagesTable);

  res.json(GetCampusSummaryResponse.parse(summary));
});

export default router;