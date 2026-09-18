import type { Garage } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";

export function getAvailabilityLabel(garage: Garage) {
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
  return garage.availabilitySource !== "demo";
}