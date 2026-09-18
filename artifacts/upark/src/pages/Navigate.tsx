import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetGarage } from "@workspace/api-client-react";
import { X, Navigation2, AlertTriangle, LocateFixed, ExternalLink } from "lucide-react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Coordinates = { lat: number; lng: number };
type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
};

const ROUTE_REFRESH_DISTANCE_METERS = 40;
const ROUTE_REFRESH_INTERVAL_MS = 15_000;

function distanceBetweenMeters(from: Coordinates, to: Coordinates) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function RouteBounds({
  origin,
  destination,
  route,
}: {
  origin: Coordinates;
  destination: Coordinates;
  route: RouteResult;
}) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(
      [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
        ...route.coordinates,
      ],
      { padding: [42, 42] },
    );
  }, [destination, map, origin, route]);

  return null;
}

function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  return miles < 0.1
    ? `${Math.max(1, Math.round(meters * 3.28084))} ft`
    : `${miles.toFixed(1)} mi`;
}

async function fetchDrivingRoute(
  origin: Coordinates,
  destination: Coordinates,
  signal: AbortSignal,
): Promise<RouteResult> {
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    { signal },
  );
  if (!response.ok) throw new Error("Routing service unavailable");

  const payload = await response.json() as {
    code?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
    }>;
  };
  const route = payload.routes?.[0];
  if (payload.code !== "Ok" || !route) throw new Error("No driving route found");

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}

export default function Navigate() {
  const { id } = useParams<{ id: string }>();
  const { data: garage, isLoading } = useGetGarage(id!);
  const [, setLocation] = useLocation();
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "requesting" | "ready" | "denied" | "unavailable"
  >("requesting");
  const [routeError, setRouteError] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const lastRouteOriginRef = useRef<Coordinates | null>(null);
  const lastRouteRefreshAtRef = useRef(0);
  const routeRef = useRef<RouteResult | null>(null);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("requesting");
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const nextOrigin = { lat: coords.latitude, lng: coords.longitude };
        const lastRouteOrigin = lastRouteOriginRef.current;
        const enoughTimePassed =
          Date.now() - lastRouteRefreshAtRef.current >= ROUTE_REFRESH_INTERVAL_MS;
        const movedEnough =
          !lastRouteOrigin ||
          distanceBetweenMeters(lastRouteOrigin, nextOrigin) >= ROUTE_REFRESH_DISTANCE_METERS;

        if (movedEnough && (!lastRouteOrigin || enoughTimePassed)) {
          lastRouteOriginRef.current = nextOrigin;
          lastRouteRefreshAtRef.current = Date.now();
          setOrigin(nextOrigin);
        }
        setLocationStatus("ready");
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 10_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const destination = useMemo(
    () => garage ? { lat: garage.latitude, lng: garage.longitude } : null,
    [garage],
  );

  useEffect(() => {
    if (!origin || !destination) return;
    const controller = new AbortController();
    setIsRecalculating(routeRef.current !== null);
    setRouteError(false);
    fetchDrivingRoute(origin, destination, controller.signal)
      .then((nextRoute) => {
        setRoute(nextRoute);
        setIsRecalculating(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRouteError(true);
          setIsRecalculating(false);
        }
      });
    return () => controller.abort();
  }, [destination, origin]);

  if (isLoading || !garage) {
    return <div className="h-screen w-full bg-gray-900 flex items-center justify-center" />;
  }

  const externalDirectionsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${garage.latitude},${garage.longitude}&travelmode=driving`;
  const statusMessage =
    locationStatus === "requesting"
      ? "Requesting your location…"
      : locationStatus === "denied"
        ? "Location permission was denied. Enable location access to see a route from where you are."
        : "Your location is unavailable. You can still open directions to this verified destination.";

  return (
    <div className="h-[100dvh] w-full bg-gray-900 relative overflow-hidden flex flex-col font-sans">
      <div className="absolute inset-0">
        <MapContainer
          center={[garage.latitude, garage.longitude]}
          zoom={16}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[garage.latitude, garage.longitude]} />
          {origin && route && (
            <>
              <Marker position={[origin.lat, origin.lng]} />
              <Polyline positions={route.coordinates} pathOptions={{ color: "#0d6efd", weight: 7 }} />
              <RouteBounds origin={origin} destination={destination!} route={route} />
            </>
          )}
        </MapContainer>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/40 pointer-events-none" />
      </div>

      <div className="relative z-10 p-4 pt-12 animate-in slide-in-from-top-10 duration-500">
        <div className="bg-[#1C2433] rounded-3xl p-6 shadow-2xl border border-white/10 flex items-center gap-6">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0">
            {route ? <Navigation2 className="text-primary w-10 h-10" /> : <LocateFixed className="text-primary w-9 h-9" />}
          </div>
          <div data-testid="status-route" className="min-w-0">
            <h2 className="text-xl font-bold text-white leading-tight mb-1">
              {route
                ? isRecalculating
                  ? "Recalculating route…"
                  : `Driving to ${garage.shortName}`
                : routeError
                  ? "Route unavailable"
                  : statusMessage}
            </h2>
            <span className="text-white/60 font-semibold">
              {route
                ? isRecalculating
                  ? "Keeping your current route visible"
                  : "Follow the highlighted route"
                : routeError
                  ? "Open directions below to continue"
                  : garage.address}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative z-10">
        {(locationStatus === "denied" || locationStatus === "unavailable" || routeError) && (
          <div data-testid="alert-route-fallback" className="absolute left-4 right-4 bottom-5 rounded-2xl border border-amber-300/30 bg-[#1C2433]/95 p-4 text-white shadow-xl backdrop-blur flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm font-medium leading-relaxed">
              {routeError
                ? "We couldn’t calculate a route right now. Your destination is still pinned at the verified FGCU coordinates."
                : statusMessage}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 bg-[#1C2433] rounded-t-3xl pb-safe-8 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="p-6">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-white/60 font-semibold mb-1 uppercase tracking-wider text-xs">Arriving at</p>
              <h3 className="text-2xl font-bold text-white">{garage.name}</h3>
            </div>
            <div className="text-right">
              <span data-testid="text-route-duration" className="text-3xl font-black text-green-400">
                {route ? Math.max(1, Math.ceil(route.durationSeconds / 60)) : "—"}
              </span>
              <span className="text-white/60 font-semibold ml-1">min</span>
              <p data-testid="text-route-distance" className="text-white/60 text-sm font-medium mt-0.5">
                {route ? formatDistance(route.distanceMeters) : "Waiting for route"}
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setLocation(`/garages/${id}`)}
              data-testid="button-exit-navigation"
              className="flex-1 bg-white/10 hover:bg-white/15 text-white h-16 rounded-2xl font-bold text-lg flex items-center justify-center transition-colors"
            >
              Exit
            </button>
            <a
              href={externalDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="link-external-directions"
              aria-label="Open directions in Google Maps"
              className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center hover:bg-primary/30 transition-colors"
            >
              <ExternalLink size={26} strokeWidth={3} />
            </a>
            <button
              className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500/30 transition-colors"
              onClick={() => setLocation(`/garages/${id}`)}
              data-testid="button-close-navigation"
              aria-label="Close navigation"
            >
              <X size={28} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
