import type { Garage } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";

export function isUserReportsOnly(garage: Garage) {
  return garage.availabilitySource === "user_reports_only";
}

export function getLatestReportLabel(garage: Garage) {
  const labels = { plenty_spots: "Plenty of Spots", filling_up: "Filling Up", almost_full: "Almost Full", full: "Full" };
  return garage.latestReportStatus ? labels[garage.latestReportStatus] : "No Recent Reports";
}

export function getAvailabilityLabel(garage: Garage) {
  if (isUserReportsOnly(garage)) {
    return garage.latestReportStatus && garage.availabilityUpdatedAt
      ? `${getLatestReportLabel(garage)} — reported ${formatDistanceToNow(new Date(garage.availabilityUpdatedAt), { addSuffix: true })}`
      : "No Recent Reports";
  }
  if (garage.availabilitySource === "demo") {
    return "Demo estimate — no verified live data yet";
  }

  const age = garage.availabilityUpdatedAt
    ? formatDistanceToNow(new Date(garage.availabilityUpdatedAt), { addSuffix: true })
    : "recently";
  const source =
    garage.availabilitySource === "verified_reports"
      ? `${garage.availabilityReportCount} verified student ${
          garage.availabilityReportCount === 1 ? "report" : "reports"
        }`
      : "trusted availability update";

  if (garage.availabilityIsStale) {
    return `Stale ${garage.availabilityConfidence}-confidence estimate from ${source}, updated ${age}`;
  }

  return `Live ${garage.availabilityConfidence}-confidence estimate from ${source}, updated ${age}`;
}

export function hasLiveAvailability(garage: Garage) {
  return garage.availabilitySource !== "demo" && !isUserReportsOnly(garage);
}