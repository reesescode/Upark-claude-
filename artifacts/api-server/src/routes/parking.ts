import { Router, type IRouter } from "express";
import { and, desc, eq, gt, gte, ilike, inArray, or, sql } from "drizzle-orm";
import {
  db,
  garagesTable,
  parkingObservationsTable,
  parkingReportsTable,
  parkingNoteFlagsTable,
  parkingContributionsTable,
  userProfilesTable,
  type GarageRecord,
  type ParkingReportRecord,
} from "@workspace/db";
import {
  CreateParkingReportBody,
  CreateParkingReportParams,
  CreateParkingReportResponse,
  FlagParkingReportNoteParams,
  FlagParkingReportNoteResponse,
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

import { authenticatedReporter, campusDay, distanceMeters, locationError, REPORT_EXPIRY_MS, similarStatus } from "../lib/parking-rewards";
import { isReportOnlyLot } from "../lib/report-only-lots";
import { moderateParkingNote, noteMentionsEmergency } from "../lib/parking-note-moderation";
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
  if (isReportOnlyLot(record)) {
    return {
      ...record,
      type: record.type === "lot" ? ("lot" as const) : ("garage" as const),
      availableSpots: null,
      occupancyPercent: null,
      status: "unknown" as const,
      availabilitySource: "user_reports_only" as const,
      availabilityConfidence: "unavailable" as const,
      availabilityIsStale: false,
      availabilityReportCount: 0,
      availabilityUpdatedAt: null,
      latestReportStatus: null,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
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
    noteEmergency: noteMentionsEmergency(record.note),
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
      ? (b.availableSpots ?? -1) - (a.availableSpots ?? -1)
      : query.data.sort === "least_full"
        ? (a.occupancyPercent ?? 101) - (b.occupancyPercent ?? 101)
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
    .where(and(eq(parkingReportsTable.garageId, params.data.garageId), gte(parkingReportsTable.createdAt, new Date(Date.now() - REPORT_EXPIRY_MS))))
    .orderBy(
      desc(parkingReportsTable.createdAt),
      desc(parkingReportsTable.id),
    )
    .limit(20);

  res.json(ListParkingReportsResponse.parse(reports.map(toParkingReport)));
});

router.post("/garages/:garageId/reports", async (req, res): Promise<void> => {
  const userId = authenticatedReporter(req);
  if (!userId) { res.status(401).json({ error: "Sign in to report parking." }); return; }
  const params = CreateParkingReportParams.safeParse(req.params);
  const body = CreateParkingReportBody.safeParse(req.body);

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.issues.some((issue) => issue.path.includes("note")) ? "Keep your note to 100 characters or fewer." : body.error.message });
    return;
  }

  const moderatedNote = moderateParkingNote(body.data.note);
  if (moderatedNote.error) {
    res.status(400).json({ error: moderatedNote.error });
    return;
  }

  const [garage] = await db
    .select()
    .from(garagesTable)
    .where(eq(garagesTable.id, params.data.garageId));

  if (!garage) {
    res.status(404).json({ error: "Garage not found" });
    return;
  }

  const error = locationError(body.data.location, garage, new Date());
  if (error) { res.status(400).json({ error }); return; }
  const [profile] = await db.select().from(userProfilesTable).where(and(eq(userProfilesTable.userId, userId), eq(userProfilesTable.authUserId, userId)));
  if (!profile) { res.status(403).json({ error: "Complete your profile before reporting parking." }); return; }

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('parking-garage'), hashtext(${garage.id}))`,
    );
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('parking-rewards'), hashtext(${userId}))`);

    const now = new Date();
    const locationFailure = locationError(body.data.location, garage, now);
    if (locationFailure) return { kind: "invalid", error: locationFailure } as const;
    const active = await tx.select().from(parkingContributionsTable).where(and(
      eq(parkingContributionsTable.garageId, garage.id), gt(parkingContributionsTable.expiresAt, now),
    ));
    if (active.some((row) => row.userId === userId && row.availabilityStatus === body.data.availabilityStatus)) {
      return { kind: "duplicate", error: "You already reported this status. Wait for it to expire or report a changed status." } as const;
    }
    const cooldownStartedAt = new Date(now.getTime() - REPORT_COOLDOWN_MS);
    const [recentVisibleReport] = await tx
      .select({ createdAt: parkingReportsTable.createdAt })
      .from(parkingReportsTable)
      .where(
        and(
          eq(parkingReportsTable.userId, userId),
          eq(parkingReportsTable.garageId, params.data.garageId),
          gte(parkingReportsTable.createdAt, cooldownStartedAt),
        ),
      )
      .orderBy(desc(parkingReportsTable.createdAt))
      .limit(1);
    const recentContribution = active
      .filter((row) => row.userId === userId && row.createdAt >= cooldownStartedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const recentReport = recentVisibleReport ?? recentContribution;

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

    const day = campusDay(now);
    const rewardedToday = await tx.select({ id: parkingContributionsTable.id }).from(parkingContributionsTable).where(and(
      eq(parkingContributionsTable.userId, userId), eq(parkingContributionsTable.rewardDay, day), gt(parkingContributionsTable.basePoints, 0),
    ));
    const basePoints = rewardedToday.length < 2 ? 10 : 0;
    const matches = active.filter((row) => row.userId !== userId && similarStatus(row.availabilityStatus, body.data.availabilityStatus));
    const bonusPoints = basePoints && matches.length ? 5 : 0;
    const [report] = await tx
      .insert(parkingReportsTable)
      .values({
        userId,
        garageId: params.data.garageId,
        availabilityStatus: body.data.availabilityStatus,
        isVerified: true,
        note: moderatedNote.note,
        createdAt: now,
      })
      .returning();
    await tx.insert(parkingContributionsTable).values({
      reportId: report.id, userId, garageId: garage.id, availabilityStatus: report.availabilityStatus,
      createdAt: now, expiresAt: new Date(now.getTime() + REPORT_EXPIRY_MS), rewardDay: day,
      basePoints, bonusPoints, confirmedByUserId: bonusPoints ? matches[0].userId : null,
      distanceMeters: distanceMeters(body.data.location, garage), accuracyMeters: body.data.location.accuracy,
    });
    const confirmIds = matches.filter((row) => row.basePoints > 0 && row.bonusPoints === 0).map((row) => row.id);
    if (confirmIds.length) await tx.update(parkingContributionsTable).set({ bonusPoints: 5, confirmedByUserId: userId }).where(inArray(parkingContributionsTable.id, confirmIds));
    return { kind: "created", report, pointsEarned: basePoints + bonusPoints } as const;
  });

  if (result.kind === "duplicate" || result.kind === "invalid") {
    res.status(result.kind === "duplicate" ? 409 : 400).json({ error: result.error }); return;
  }
  if (result.kind === "rate-limited") {
    res
      .set("Retry-After", String(result.rateLimit.retryAfterSeconds))
      .status(429)
      .json(result.rateLimit);
    return;
  }

  res
    .status(201)
    .json(CreateParkingReportResponse.parse({ ...toParkingReport(result.report), expiresAt: new Date(result.report.createdAt.getTime() + REPORT_EXPIRY_MS).toISOString(), pointsEarned: result.pointsEarned }));
});

router.post("/garages/:garageId/reports/:reportId/flag", async (req, res): Promise<void> => {
  const userId = authenticatedReporter(req);
  if (!userId) { res.status(401).json({ error: "Sign in to flag a note." }); return; }
  const params = FlagParkingReportNoteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid report." }); return; }
  const [profile] = await db.select({ userId: userProfilesTable.userId }).from(userProfilesTable)
    .where(and(eq(userProfilesTable.userId, userId), eq(userProfilesTable.authUserId, userId)));
  if (!profile) { res.status(403).json({ error: "Complete your profile before flagging a note." }); return; }
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('parking-note-flags'), hashtext(${userId}))`);
    const [report] = await tx.select().from(parkingReportsTable).where(and(
      eq(parkingReportsTable.id, params.data.reportId),
      eq(parkingReportsTable.garageId, params.data.garageId),
      gt(parkingReportsTable.createdAt, new Date(Date.now() - REPORT_EXPIRY_MS)),
    ));
    if (!report?.note) return { status: 404, error: "This active note is no longer available." };
    if (report.userId === userId) return { status: 403, error: "You cannot flag your own note." };
    const [existing] = await tx.select({ id: parkingNoteFlagsTable.id }).from(parkingNoteFlagsTable).where(and(
      eq(parkingNoteFlagsTable.reportId, report.id), eq(parkingNoteFlagsTable.userId, userId),
    ));
    if (existing) return { status: 200 };
    const recent = await tx.select({ id: parkingNoteFlagsTable.id }).from(parkingNoteFlagsTable).where(and(
      eq(parkingNoteFlagsTable.userId, userId),
      gt(parkingNoteFlagsTable.createdAt, new Date(Date.now() - 24 * 60 * 60_000)),
    ));
    if (recent.length >= 20) return { status: 429, error: "You've reached the daily flag limit. Please try again later." };
    await tx.insert(parkingNoteFlagsTable).values({ reportId: report.id, userId });
    return { status: 200 };
  });
  if (result.status !== 200) { res.status(result.status).json({ error: result.error }); return; }
  res.json(FlagParkingReportNoteResponse.parse({ message: "Thanks. This note has been flagged for review." }));
});

router.get("/campus/summary", async (_req, res): Promise<void> => {
  const garages = await getGaragesWithAvailability();
  const liveGarages = garages.filter(
    (garage) => garage.availabilitySource !== "demo" && garage.availabilitySource !== "user_reports_only",
  );
  const latestLiveUpdate = liveGarages
    .map((garage) => garage.availabilityUpdatedAt)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1);
  res.json(
    GetCampusSummaryResponse.parse({
      openSpots: garages.reduce(
        (total, garage) => total + (garage.availableSpots ?? 0),
        0,
      ),
      totalSpots: garages.reduce(
        (total, garage) => total + (garage.availabilitySource === "user_reports_only" ? 0 : garage.totalSpots),
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