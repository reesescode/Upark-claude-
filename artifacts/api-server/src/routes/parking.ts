import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import {
  db,
  garagesTable,
  parkingObservationsTable,
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
} from "@workspace/api-zod";
import {
  estimateGarageAvailability,
  LIVE_WINDOW_MS,
  type AvailabilityReport,
  type CalibrationReport,
} from "../lib/parking-estimator";

const router: IRouter = Router();
const REPORT_COOLDOWN_MS = 5 * 60 * 1_000;
const LEGACY_GARAGE_ID_PATTERN = /^garage-?([1-4])$/i;

function getLegacyGarageNumber(garageId: string) {
  return LEGACY_GARAGE_ID_PATTERN.exec(garageId)?.[1] ?? null;
}

function garageIdWhere(garageId: string) {
  const legacyNumber = getLegacyGarageNumber(garageId);
  if (!legacyNumber) return eq(garagesTable.id, garageId);

  const garageLabel = `Garage ${legacyNumber}`;
  return or(
    eq(garagesTable.id, garageId),
    ilike(garagesTable.name, `%${garageLabel}%`),
    ilike(garagesTable.shortName, `%${garageLabel}%`),
  );
}

function toGarage(
  record: GarageRecord,
  reports: AvailabilityReport[] = [],
  calibrationReports: CalibrationReport[] = [],
  observations: Pick<
    typeof parkingObservationsTable.$inferSelect,
    "availableSpots" | "totalSpots" | "observedAt"
  >[] = [],
  now = new Date(),
) {
  const availability = estimateGarageAvailability(
    record,
    reports,
    calibrationReports,
    observations,
    now,
  );
  const occupancyPercent = Math.round(
    ((record.totalSpots - availability.availableSpots) / record.totalSpots) *
      100,
  );
  const status =
    occupancyPercent >= 90
      ? ("nearly_full" as const)
      : occupancyPercent >= 70
        ? ("filling_up" as const)
        : ("open" as const);

  return {
    ...record,
    ...availability,
    type: record.type === "lot" ? ("lot" as const) : ("garage" as const),
    occupancyPercent,
    status,
    updatedAt: record.updatedAt.toISOString(),
    availabilityUpdatedAt:
      availability.availabilityUpdatedAt?.toISOString() ?? null,
  };
}

function toParkingReport(record: ParkingReportRecord) {
  return {
    ...record,
    isVerified: record.isVerified,
    createdAt: record.createdAt.toISOString(),
  };
}

async function getGaragesWithAvailability(where?: ReturnType<typeof or>) {
  const records = await db.select().from(garagesTable).where(where);
  const garageIds = records.map((record) => record.id);
  if (garageIds.length === 0) return [];
  const liveCutoff = new Date(Date.now() - LIVE_WINDOW_MS);
  const reports = await db
    .select({
      garageId: parkingReportsTable.garageId,
      userId: parkingReportsTable.userId,
      availabilityStatus: parkingReportsTable.availabilityStatus,
      createdAt: parkingReportsTable.createdAt,
    })
    .from(parkingReportsTable)
    .where(
      and(
        eq(parkingReportsTable.isVerified, true),
        gte(parkingReportsTable.createdAt, liveCutoff),
      ),
    );
  const reportsByGarage = new Map<string, AvailabilityReport[]>();
  for (const report of reports) {
    const garageReports = reportsByGarage.get(report.garageId) ?? [];
    garageReports.push(report);
    reportsByGarage.set(report.garageId, garageReports);
  }
  const [calibrationReports, observations] = await Promise.all([
    db
      .select()
      .from(parkingReportsTable)
      .where(
        and(
          inArray(parkingReportsTable.garageId, garageIds),
          eq(parkingReportsTable.isVerified, true),
        ),
      ),
    db
      .select()
      .from(parkingObservationsTable)
      .where(inArray(parkingObservationsTable.garageId, garageIds)),
  ]);
  const now = new Date();
  return records.map((record) =>
    toGarage(
      record,
      reportsByGarage.get(record.id),
      calibrationReports.filter((report) => report.garageId === record.id),
      observations.filter((observation) => observation.garageId === record.id),
      now,
    ),
  );
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

  const garages = await getGaragesWithAvailability(where);
  garages.sort((a, b) =>
    query.data.sort === "most_available"
      ? b.availableSpots - a.availableSpots
      : query.data.sort === "least_full"
        ? a.occupancyPercent - b.occupancyPercent
        : a.distanceMiles - b.distanceMiles,
  );
  res.json(ListGaragesResponse.parse(garages));
});

router.get("/garages/:garageId", async (req, res): Promise<void> => {
  const params = GetGarageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const matchingRecords = await db
    .select()
    .from(garagesTable)
    .where(garageIdWhere(params.data.garageId));
  const record =
    matchingRecords.find(
      (candidate) =>
        !getLegacyGarageNumber(candidate.id) ||
        candidate.id === params.data.garageId && matchingRecords.length === 1,
    ) ?? matchingRecords[0];

  if (!record) {
    res.status(404).json({ error: "Garage not found" });
    return;
  }
  const liveCutoff = new Date(Date.now() - LIVE_WINDOW_MS);
  const reports = await db
    .select({
      garageId: parkingReportsTable.garageId,
      userId: parkingReportsTable.userId,
      availabilityStatus: parkingReportsTable.availabilityStatus,
      createdAt: parkingReportsTable.createdAt,
    })
    .from(parkingReportsTable)
    .where(
      and(
        eq(parkingReportsTable.garageId, record.id),
        eq(parkingReportsTable.isVerified, true),
        gte(parkingReportsTable.createdAt, liveCutoff),
      ),
    );
  const [calibrationReports, observations] = await Promise.all([
    db
      .select()
      .from(parkingReportsTable)
      .where(
        and(
          eq(parkingReportsTable.garageId, record.id),
          eq(parkingReportsTable.isVerified, true),
        ),
      ),
    db
      .select()
      .from(parkingObservationsTable)
      .where(eq(parkingObservationsTable.garageId, record.id)),
  ]);
  res.json(
    GetGarageResponse.parse(
      toGarage(record, reports, calibrationReports, observations),
    ),
  );
});

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

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${body.data.userId}), hashtext(${params.data.garageId}))`,
    );

    const now = new Date();
    const cooldownStartedAt = new Date(now.getTime() - REPORT_COOLDOWN_MS);
    const [recentReport] = await tx
      .select({ createdAt: parkingReportsTable.createdAt })
      .from(parkingReportsTable)
      .where(
        and(
          eq(parkingReportsTable.userId, body.data.userId),
          eq(parkingReportsTable.garageId, params.data.garageId),
          gte(parkingReportsTable.createdAt, cooldownStartedAt),
        ),
      )
      .orderBy(desc(parkingReportsTable.createdAt))
      .limit(1);

    if (recentReport) {
      const nextAllowedAt = new Date(
        recentReport.createdAt.getTime() + REPORT_COOLDOWN_MS,
      );
      return {
        kind: "rate-limited",
        rateLimit: {
          error: `You recently reported this garage. You can report again in ${Math.max(1, Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 60_000))} minute(s).`,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 1_000),
          ),
          nextAllowedAt: nextAllowedAt.toISOString(),
        },
      } as const;
    }

    const [report] = await tx
      .insert(parkingReportsTable)
      .values({
        userId: body.data.userId,
        garageId: params.data.garageId,
        availabilityStatus: body.data.availabilityStatus,
      })
      .returning();
    return { kind: "created", report } as const;
  });

  if (result.kind === "rate-limited") {
    res
      .set("Retry-After", String(result.rateLimit.retryAfterSeconds))
      .status(429)
      .json(result.rateLimit);
    return;
  }

  res
    .status(201)
    .json(CreateParkingReportResponse.parse(toParkingReport(result.report)));
});

router.get("/campus/summary", async (_req, res): Promise<void> => {
  const garages = await getGaragesWithAvailability();
  const liveGarages = garages.filter(
    (garage) => garage.availabilitySource !== "demo",
  );
  const latestLiveUpdate = liveGarages
    .map((garage) => garage.availabilityUpdatedAt)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1);
  res.json(
    GetCampusSummaryResponse.parse({
      openSpots: garages.reduce(
        (total, garage) => total + garage.availableSpots,
        0,
      ),
      totalSpots: garages.reduce(
        (total, garage) => total + garage.totalSpots,
        0,
      ),
      garagesCount: garages.length,
      lastUpdatedAt: latestLiveUpdate ?? null,
      liveGaragesCount: liveGarages.length,
      staleGaragesCount: liveGarages.filter(
        (garage) => garage.availabilityIsStale,
      ).length,
      demoGaragesCount: garages.filter(
        (garage) => garage.availabilitySource === "demo",
      ).length,
    }),
  );
});

export default router;