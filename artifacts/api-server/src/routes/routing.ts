import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, garagesTable } from "@workspace/db";
import {
  GetGarageRouteBody,
  GetGarageRouteParams,
  GetGarageRouteResponse,
} from "@workspace/api-zod";
import {
  getCachedDrivingRoute,
  RoutingProviderError,
} from "../lib/routing";

const router: IRouter = Router();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const MAX_TRACKED_CLIENTS = 10_000;
const clientRequests = new Map<string, { count: number; resetAt: number }>();

function pruneClientRequests(now: number): void {
  for (const [clientId, entry] of clientRequests) {
    if (entry.resetAt <= now) clientRequests.delete(clientId);
  }
  while (clientRequests.size >= MAX_TRACKED_CLIENTS) {
    const oldestClientId = clientRequests.keys().next().value as string | undefined;
    if (!oldestClientId) break;
    clientRequests.delete(oldestClientId);
  }
}

export function consumeRouteQuota(clientId: string, now: number): number | null {
  const current = clientRequests.get(clientId);
  if (!current || current.resetAt <= now) {
    pruneClientRequests(now);
    clientRequests.set(clientId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return null;
  }
  current.count += 1;
  return current.count > RATE_LIMIT
    ? Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    : null;
}

export function resetRouteQuotaForTests(): void {
  clientRequests.clear();
}

router.post("/garages/:garageId/route", async (req, res): Promise<void> => {
  const params = GetGarageRouteParams.safeParse(req.params);
  const body = GetGarageRouteBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: "Origin coordinates are invalid.",
      code: "INVALID_ROUTE_REQUEST",
    });
    return;
  }

  const now = Date.now();
  const clientId = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const retryAfterSeconds = consumeRouteQuota(clientId, now);
  if (retryAfterSeconds !== null) {
    res.set("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: "Too many route requests. Please try again shortly.",
      code: "ROUTE_RATE_LIMITED",
    });
    return;
  }

  const [garage] = await db
    .select({
      id: garagesTable.id,
      latitude: garagesTable.latitude,
      longitude: garagesTable.longitude,
    })
    .from(garagesTable)
    .where(eq(garagesTable.id, params.data.garageId))
    .limit(1);

  if (!garage) {
    res.status(404).json({
      error: "Garage not found.",
      code: "GARAGE_NOT_FOUND",
    });
    return;
  }

  try {
    const route = await getCachedDrivingRoute(
      garage.id,
      { lat: body.data.originLat, lng: body.data.originLng },
      { lat: garage.latitude, lng: garage.longitude },
    );
    res.set("Cache-Control", "private, max-age=30");
    res.json(GetGarageRouteResponse.parse(route));
  } catch (error) {
    const providerStatus =
      error instanceof RoutingProviderError ? error.providerStatus : undefined;
    req.log.warn(
      { garageId: garage.id, providerStatus },
      "Routing provider unavailable",
    );
    res.status(503).json({
      error: "A driving route is temporarily unavailable.",
      code: "ROUTE_UNAVAILABLE",
    });
  }
});

export default router;