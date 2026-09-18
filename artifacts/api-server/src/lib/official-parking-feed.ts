import https from "node:https";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db, garagesTable } from "@workspace/db";
import { logger } from "./logger";

export const FGCU_GARAGE_AVAILABILITY_PAGE =
  "https://www.fgcu.edu/parkingservices/garage-availability";
export const FGCU_GARAGE_AVAILABILITY_FEED =
  "https://logixoncloud.com/source/widget/2ad42222a7d6a828012fdb7ee3b98216";

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const EASTERN_TIME_ZONE = "America/New_York";

export type OfficialParkingObservation = {
  locationName: string;
  availableSpots: number;
  totalSpots: number;
  observedAt: Date;
};

type FeedRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FeedRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNonNegativeInteger(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function easternWallTimeToUtc(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}) {
  let timestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  for (let pass = 0; pass < 2; pass += 1) {
    const formatted = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const representedAsUtc = Date.UTC(
      formatted["year"],
      formatted["month"] - 1,
      formatted["day"],
      formatted["hour"],
      formatted["minute"],
      formatted["second"],
    );
    const desiredAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    timestamp += desiredAsUtc - representedAsUtc;
  }
  return new Date(timestamp);
}

function parseObservationTime(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const source = value.trim();

  if (/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(source)) {
    const parsed = new Date(source);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const yearFirstDate = source.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[,\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  const monthFirstDate = source.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[,\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
  );
  if (!yearFirstDate && !monthFirstDate) return null;

  const year = Number(yearFirstDate?.[1] ?? monthFirstDate?.[3]);
  const month = Number(yearFirstDate?.[2] ?? monthFirstDate?.[1]);
  const day = Number(yearFirstDate?.[3] ?? monthFirstDate?.[2]);
  const sourceHour = yearFirstDate?.[4] ?? monthFirstDate?.[4];
  const sourceMinute = yearFirstDate?.[5] ?? monthFirstDate?.[5];
  const sourceSecond = yearFirstDate?.[6] ?? monthFirstDate?.[6] ?? 0;

  let hour = Number(sourceHour);
  const meridiem = monthFirstDate?.[7]?.toUpperCase();
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (hour > 23) return null;

  const parsed = easternWallTimeToUtc({
    month,
    day,
    year,
    hour,
    minute: Number(sourceMinute),
    second: Number(sourceSecond),
  });
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseOfficialParkingFeed(
  payload: unknown,
): OfficialParkingObservation[] {
  if (!isRecord(payload) || !Array.isArray(payload["widgetData"])) {
    throw new Error("FGCU parking feed did not contain widgetData");
  }

  return payload["widgetData"].flatMap((value) => {
    if (!isRecord(value)) return [];
    const locationName =
      typeof value["locationName"] === "string"
        ? value["locationName"].trim()
        : "";
    const availableSpots = parseNonNegativeInteger(value["freeSpaces"]);
    const totalSpots = parseNonNegativeInteger(value["totalSpaces"]);
    const observedAt = parseObservationTime(value["dateTime"]);

    if (
      !locationName ||
      availableSpots === null ||
      totalSpots === null ||
      totalSpots === 0 ||
      availableSpots > totalSpots ||
      observedAt === null
    ) {
      return [];
    }

    return [{ locationName, availableSpots, totalSpots, observedAt }];
  });
}

export function getGarageIdForOfficialLocation(locationName: string) {
  const normalized = locationName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = /^(?:parking)?(?:garage|pg)([1-4])$/.exec(normalized);
  const garageNumber = match?.[1];
  return garageNumber === "1"
    ? "north-deck"
    : garageNumber === "2"
      ? "science-center"
      : garageNumber === "3"
        ? "library-garage"
        : garageNumber === "4"
          ? "arts-garage"
          : null;
}

export function fetchOfficialParkingPayload(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      FGCU_GARAGE_AVAILABILITY_FEED,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "UPARK/1.0",
          "X-Requested-With": "XMLHttpRequest",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let receivedBytes = 0;

        response.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_RESPONSE_BYTES) {
            request.destroy(
              new Error("FGCU parking feed exceeded the response size limit"),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (
            response.statusCode === undefined ||
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            reject(
              new Error(
                `FGCU parking feed returned HTTP ${response.statusCode ?? "unknown"}`,
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("FGCU parking feed returned invalid JSON"));
          }
        });
      },
    );

    request.setTimeout(FETCH_TIMEOUT_MS, () => {
      request.destroy(new Error("FGCU parking feed request timed out"));
    });
    request.on("error", reject);
  });
}

export async function syncOfficialParkingAvailability(
  loadPayload: () => Promise<unknown> = fetchOfficialParkingPayload,
  now = new Date(),
) {
  const observations = parseOfficialParkingFeed(await loadPayload());
  const latestByGarage = new Map<string, OfficialParkingObservation>();
  for (const observation of observations) {
    const garageId = getGarageIdForOfficialLocation(observation.locationName);
    if (
      !garageId ||
      observation.observedAt.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS
    ) {
      continue;
    }
    const existing = latestByGarage.get(garageId);
    if (!existing || observation.observedAt > existing.observedAt) {
      latestByGarage.set(garageId, observation);
    }
  }

  if (latestByGarage.size === 0) {
    throw new Error("FGCU parking feed contained no recognized observations");
  }

  let updatedGarages = 0;
  for (const [garageId, observation] of latestByGarage) {
    const updated = await db
      .update(garagesTable)
      .set({
        availableSpots: observation.availableSpots,
        totalSpots: observation.totalSpots,
        availabilityUpdatedAt: observation.observedAt,
      })
      .where(
        and(
          eq(garagesTable.id, garageId),
          or(
            isNull(garagesTable.availabilityUpdatedAt),
            lte(garagesTable.availabilityUpdatedAt, observation.observedAt),
          ),
        ),
      )
      .returning({ id: garagesTable.id });
    updatedGarages += updated.length;
  }

  return {
    sourcePage: FGCU_GARAGE_AVAILABILITY_PAGE,
    receivedObservations: observations.length,
    recognizedGarages: latestByGarage.size,
    updatedGarages,
  };
}

export function startOfficialParkingSync() {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let syncInProgress = false;

  const poll = async () => {
    if (stopped || syncInProgress) return;
    syncInProgress = true;
    try {
      const result = await syncOfficialParkingAvailability();
      logger.info(result, "Synced official FGCU parking availability");
    } catch (err) {
      logger.warn(
        { err, sourcePage: FGCU_GARAGE_AVAILABILITY_PAGE },
        "Official FGCU parking sync failed; retaining prior observation times",
      );
    } finally {
      syncInProgress = false;
      if (!stopped) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        timer.unref();
      }
    }
  };

  void poll();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}