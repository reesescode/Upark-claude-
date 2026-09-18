import {
  GetGarageRouteResponse,
  type DrivingRoute,
} from "@workspace/api-zod";

const ROUTE_CACHE_TTL_MS = 2 * 60_000;
const MAX_CACHE_ENTRIES = 500;
const PROVIDER_TIMEOUT_MS = 6_000;
const ORIGIN_PRECISION = 4;

type Coordinates = { lat: number; lng: number };
type CachedRoute = { expiresAt: number; route: DrivingRoute };

const routeCache = new Map<string, CachedRoute>();
const pendingRoutes = new Map<string, Promise<DrivingRoute>>();

export class RoutingProviderError extends Error {
  constructor(
    message: string,
    readonly providerStatus?: number,
  ) {
    super(message);
    this.name = "RoutingProviderError";
  }
}

function cacheKey(
  garageId: string,
  origin: Coordinates,
  destination: Coordinates,
): string {
  return [
    garageId,
    origin.lat.toFixed(ORIGIN_PRECISION),
    origin.lng.toFixed(ORIGIN_PRECISION),
    destination.lat.toFixed(6),
    destination.lng.toFixed(6),
  ].join(":");
}

function pruneCache(now: number): void {
  for (const [key, entry] of routeCache) {
    if (entry.expiresAt <= now) routeCache.delete(key);
  }
  while (routeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = routeCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    routeCache.delete(oldestKey);
  }
}

async function requestProvider(
  origin: Coordinates,
  destination: Coordinates,
): Promise<DrivingRoute> {
  const providerBaseUrl =
    process.env.ROUTING_PROVIDER_URL ?? "https://router.project-osrm.org";
  const coordinates =
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(
    `/route/v1/driving/${coordinates}`,
    providerBaseUrl,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "UPARK-Campus-Parking/1.0",
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  }).catch((cause: unknown) => {
    throw new RoutingProviderError(
      cause instanceof Error ? cause.message : "Routing provider request failed",
    );
  });

  if (!response.ok) {
    throw new RoutingProviderError(
      "Routing provider returned an error",
      response.status,
    );
  }

  const payload = await response.json().catch(() => null) as {
    code?: string;
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: [number, number][] };
    }>;
  } | null;
  const providerRoute = payload?.routes?.[0];

  if (
    payload?.code !== "Ok" ||
    !providerRoute ||
    typeof providerRoute.distance !== "number" ||
    typeof providerRoute.duration !== "number" ||
    !Array.isArray(providerRoute.geometry?.coordinates)
  ) {
    throw new RoutingProviderError("Routing provider returned an invalid route");
  }

  return GetGarageRouteResponse.parse({
    distanceMeters: providerRoute.distance,
    durationSeconds: providerRoute.duration,
    coordinates: providerRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  });
}

export async function getCachedDrivingRoute(
  garageId: string,
  origin: Coordinates,
  destination: Coordinates,
): Promise<DrivingRoute> {
  const key = cacheKey(garageId, origin, destination);
  const now = Date.now();
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > now) return cached.route;

  const pending = pendingRoutes.get(key);
  if (pending) return pending;

  const request = requestProvider(origin, destination)
    .then((route) => {
      pruneCache(Date.now());
      routeCache.set(key, {
        expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
        route,
      });
      return route;
    })
    .finally(() => pendingRoutes.delete(key));

  pendingRoutes.set(key, request);
  return request;
}

export function resetRoutingStateForTests(): void {
  routeCache.clear();
  pendingRoutes.clear();
}