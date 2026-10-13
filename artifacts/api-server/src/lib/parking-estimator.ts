import type {
  GarageRecord,
  ParkingObservationRecord,
  ParkingReportRecord,
} from "@workspace/db";

export const LIVE_WINDOW_MS = 30 * 60 * 1_000;
export const STALE_AFTER_MS = 30 * 60 * 1_000;
const CALIBRATION_WINDOW_MS = 2 * 60 * 60 * 1_000;

export type AvailabilityReport = Pick<
  ParkingReportRecord,
  "garageId" | "userId" | "availabilityStatus" | "createdAt"
>;

export type CalibrationReport = AvailabilityReport & { id: number };
export type CalibrationObservation = Pick<
  ParkingObservationRecord,
  "availableSpots" | "totalSpots" | "observedAt"
>;

const defaultRatios: Record<
  ParkingReportRecord["availabilityStatus"],
  number
> = {
  plenty_spots: 0.5,
  filling_up: 0.25,
  almost_full: 0.08,
  full: 0,
};

const MIN_LOCAL_OUTCOMES = 5;
const FULL_LOCAL_WEIGHT_OUTCOMES = 20;

export function buildCalibratedRatios(
  reports: CalibrationReport[],
  observations: CalibrationObservation[],
) {
  const outcomes = new Map<
    ParkingReportRecord["availabilityStatus"],
    { weightedRatio: number; weight: number; count: number }
  >();
  const measuredAgeBuckets = new Set<string>();

  for (const observation of observations) {
    const observationTime = observation.observedAt.getTime();
    const latestByStudent = new Map<string, CalibrationReport>();
    for (const report of reports) {
      const ageMs = observationTime - report.createdAt.getTime();
      if (ageMs < 0 || ageMs > CALIBRATION_WINDOW_MS) continue;
      const current = latestByStudent.get(report.userId);
      if (!current || report.createdAt > current.createdAt) {
        latestByStudent.set(report.userId, report);
      }
    }

    const observedRatio =
      observation.totalSpots > 0
        ? observation.availableSpots / observation.totalSpots
        : 0;
    for (const report of latestByStudent.values()) {
      const ageMs = observationTime - report.createdAt.getTime();
      const ageBucket =
        ageMs < 15 * 60_000
          ? "under_15m"
          : ageMs < 30 * 60_000
            ? "15_to_30m"
            : ageMs < 60 * 60_000
              ? "30_to_60m"
              : "60_to_120m";
      const outcomeKey = `${report.id}:${ageBucket}`;
      if (measuredAgeBuckets.has(outcomeKey)) continue;
      measuredAgeBuckets.add(outcomeKey);
      const weight = Math.max(0.25, 1 - ageMs / CALIBRATION_WINDOW_MS);
      const current = outcomes.get(report.availabilityStatus) ?? {
        weightedRatio: 0,
        weight: 0,
        count: 0,
      };
      current.weightedRatio += observedRatio * weight;
      current.weight += weight;
      current.count += 1;
      outcomes.set(report.availabilityStatus, current);
    }
  }

  const ratios = { ...defaultRatios };
  let totalOutcomes = 0;
  for (const [status, outcome] of outcomes) {
    totalOutcomes += outcome.count;
    if (outcome.count < MIN_LOCAL_OUTCOMES || outcome.weight === 0) continue;
    const localRatio = outcome.weightedRatio / outcome.weight;
    const localWeight = Math.min(
      1,
      (outcome.count - MIN_LOCAL_OUTCOMES + 1) /
        (FULL_LOCAL_WEIGHT_OUTCOMES - MIN_LOCAL_OUTCOMES + 1),
    );
    ratios[status] =
      defaultRatios[status] * (1 - localWeight) + localRatio * localWeight;
  }

  return { ratios, totalOutcomes };
}

export function estimateGarageAvailability(
  record: GarageRecord,
  reports: AvailabilityReport[],
  calibrationReports: CalibrationReport[] = [],
  observations: CalibrationObservation[] = [],
  now = new Date(),
  allowDirectUpdate = true,
) {
  // Reports are display-only; only the existing live source may drive availability.
  reports = [];
  const cutoff = now.getTime() - LIVE_WINDOW_MS;
  const latestByStudent = new Map<string, AvailabilityReport>();
  for (const report of reports) {
    if (report.createdAt.getTime() < cutoff || report.createdAt > now) continue;
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
    allowDirectUpdate &&
    record.availabilityUpdatedAt !== null &&
    record.availabilityUpdatedAt.getTime() >= cutoff &&
    record.availabilityUpdatedAt <= now;
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
    const calibration = buildCalibratedRatios(
      calibrationReports,
      observations,
    );
    let weightTotal = 0;
    const weightedRatio = verifiedReports.reduce((total, report) => {
      const ageMs = now.getTime() - report.createdAt.getTime();
      const weight = Math.max(0.25, 1 - ageMs / LIVE_WINDOW_MS);
      weightTotal += weight;
      return total + calibration.ratios[report.availabilityStatus] * weight;
    }, 0);
    const confidenceEvidence =
      verifiedReports.length + Math.min(2, Math.floor(calibration.totalOutcomes / 10));

    return {
      availableSpots: Math.round(
        record.totalSpots * (weightedRatio / weightTotal),
      ),
      availabilitySource: "verified_reports" as const,
      availabilityConfidence:
        confidenceEvidence >= 3
          ? ("high" as const)
          : confidenceEvidence >= 2
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