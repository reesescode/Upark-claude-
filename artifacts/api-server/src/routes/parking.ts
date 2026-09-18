import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
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
} from "@workspace/api-zod";

const router: IRouter = Router();
const REPORT_COOLDOWN_MS = 5 * 60 * 1_000;
const LIVE_WINDOW_MS = 2 * 60 * 60 * 1_000;
const STALE_AFTER_MS = 30 * 60 * 1_000;

type AvailabilityReport = Pick<
  ParkingReportRecord,
  "garageId" | "userId" | "availabilityStatus" | "createdAt"
>;

const availabilityRatios: Record<
  ParkingReportRecord["availabilityStatus"],
  number
> = {
  plenty_spots: 0.5,
  filling_up: 0.25,
  almost_full: 0.08,
  full: 0,
};

function estimateGarageAvailability(
  record: GarageRecord,
  reports: AvailabilityReport[],
  now = new Date(),
) {
  const cutoff = now.getTime() - LIVE_WINDOW_MS;
  const latestByStudent = new Map<string, AvailabilityReport>();
  for (const report of reports) {
    if (report.createdAt.getTime() < cutoff) continue;
    const current = latestByStudent.get(report.userId);
    if (!current || report.createdAt > current.createdAt) {
      latestByStudent.set(report.userId, report);
    }
  }

  const verifiedReports = [...latestByStudent.values()];
  const newestReportAt =
    verifiedReports.length > 0
      ? new Date(
          Math.max(...verifiedReports.map((report) => report.createdAt.getTime())),
        )
      : null;
  const directUpdateIsLive =
    record.availabilityUpdatedAt !== null &&
    record.availabilityUpdatedAt.getTime() >= cutoff;
  const useDirectUpdate =
    directUpdateIsLive &&
    (!newestReportAt ||
      record.availabilityUpdatedAt!.getTime() >= newestReportAt.getTime());

  if (useDirectUpdate) {
    return {
      availableSpots: record.availableSpots,
      availabilitySource: "live_update" as const,
      availabilityConfidence: "high" as const,
      availabilityIsStale:
        now.getTime() - record.availabilityUpdatedAt!.getTime() >
        STALE_AFTER_MS,
      availabilityReportCount: 0,
      availabilityUpdatedAt: record.availabilityUpdatedAt,
    };
  }

  if (verifiedReports.length > 0 && newestReportAt) {
    const weightedRatio =
      verifiedReports.reduce((total, report) => {
        const ageMs = now.getTime() - report.createdAt.getTime();
        const recencyWeight = Math.max(0.25, 1 - ageMs / LIVE_WINDOW_MS);
        return (
          total + availabilityRatios[report.availabilityStatus] * recencyWeight
        );
      }, 0) /
      verifiedReports.reduce((total, report) => {
        const ageMs = now.getTime() - report.createdAt.getTime();
        return total + Math.max(0.25, 1 - ageMs / LIVE_WINDOW_MS);
      }, 0);

    return {
      availableSpots: Math.round(record.totalSpots * weightedRatio),
      availabilitySource: "verified_reports" as const,
      availabilityConfidence:
        verifiedReports.length >= 3
          ? ("high" as const)
          : verifiedReports.length === 2
            ? ("medium" as const)
            : ("low" as const),
      availabilityIsStale:
        now.getTime() - newestReportAt.getTime() > STALE_AFTER_MS,
      availabilityReportCount: verifiedReports.length,
      availabilityUpdatedAt: newestReportAt,
    };
  }

  return {
    availableSpots: record.availableSpots,
    availabilitySource: "demo" as const,
    availabilityConfidence: "unavailable" as const,
    availabilityIsStale: false,
    availabilityReportCount: 0,
    availabilityUpdatedAt: null,
  };
}

function toGarage(
  record: GarageRecord,
  reports: AvailabilityReport[] = [],
  now = new Date(),
) {
  const availability = estimateGarageAvailability(record, reports, now);
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
  const now = new Date();
  return records.map((record) =>
    toGarage(record, reportsByGarage.get(record.id), now),
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

  const [record] = await db
    .select()
    .from(garagesTable)
    .where(eq(garagesTable.id, params.data.garageId));

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
  res.json(GetGarageResponse.parse(toGarage(record, reports)));
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
      lastUpdatedAt: latestLiveUpdate ?? new Date().toISOString(),
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