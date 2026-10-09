import type { Request } from "express";
import { getAuth } from "@clerk/express";
import type { ParkingContribution } from "@workspace/db";

export const REWARD_TIME_ZONE = "America/New_York";
export const REPORT_EXPIRY_MS = 30 * 60_000;
export const TOO_FAR_MESSAGE = "You must be near this garage to report its parking status.";

export function authenticatedReporter(req: Request) {
  return process.env.NODE_ENV === "test" ? req.header("x-test-user-id") : getAuth(req).userId;
}

export function campusDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REWARD_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function rewardLevel(points: number) {
  return points >= 300 ? "U Park MVP" : points >= 150 ? "Parking Pro" : points >= 50 ? "Campus Helper" : "New Reporter";
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function locationError(location: { latitude: number; longitude: number; accuracy: number; timestamp: number }, garage: { latitude: number; longitude: number }, now: Date) {
  if (!Object.values(location).every(Number.isFinite) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180 || location.accuracy < 0 || location.accuracy > 100) {
    return "Your location is not accurate enough. Enable precise location and try again.";
  }
  const age = now.getTime() - location.timestamp;
  if (age > 60_000 || age < -10_000) return "Your location reading has expired. Please try again.";
  return distanceMeters(location, garage) > 100 ? TOO_FAR_MESSAGE : null;
}

const statuses = ["plenty_spots", "filling_up", "almost_full", "full"];
export function similarStatus(a: string, b: string) {
  return Math.abs(statuses.indexOf(a) - statuses.indexOf(b)) <= 1;
}

export function summarizeRewards(rows: ParkingContribution[], now = new Date()) {
  const today = campusDay(now);
  const totalPoints = rows.reduce((sum, row) => sum + row.basePoints + row.bonusPoints, 0);
  const days = new Set(rows.map((row) => row.rewardDay));
  let currentStreak = 0;
  let cursor = new Date(`${today}T12:00:00Z`);
  if (!days.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    currentStreak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  // Find next campus midnight using real instants, including DST transitions.
  let low = now.getTime();
  let high = low + 27 * 60 * 60_000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (campusDay(new Date(mid)) === today) low = mid;
    else high = mid;
  }
  return {
    totalPoints, validReports: rows.length, currentStreak,
    reportsRemainingToday: Math.max(0, 2 - rows.filter((row) => row.rewardDay === today && row.basePoints > 0).length),
    level: rewardLevel(totalPoints), resetsAt: new Date(high).toISOString(), timeZone: REWARD_TIME_ZONE,
  };
}
