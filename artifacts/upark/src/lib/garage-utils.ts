import { GarageStatus } from "@workspace/api-client-react";

export function getStatusColor(status: GarageStatus) {
  switch (status) {
    case "open":
      return "text-success bg-success/10 border-success/20";
    case "filling_up":
      return "text-warning bg-warning/10 border-warning/20";
    case "nearly_full":
      return "text-destructive bg-destructive/10 border-destructive/20";
    default:
      return "text-gray-500 bg-gray-100 border-gray-200";
  }
}

export function getStatusColorSolid(status: GarageStatus) {
  switch (status) {
    case "open":
      return "bg-success";
    case "filling_up":
      return "bg-warning";
    case "nearly_full":
      return "bg-destructive";
    default:
      return "bg-gray-400";
  }
}

export function getStatusText(status: GarageStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "filling_up":
      return "Filling Up";
    case "nearly_full":
      return "Nearly Full";
    default:
      return "Unknown";
  }
}

export function formatDistance(miles: number) {
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}
