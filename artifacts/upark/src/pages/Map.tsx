import { useState, useMemo, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListGarages,
  useGetCampusSummary,
  type Garage,
} from "@workspace/api-client-react";
import { Search, MapPin, Navigation, Info, List, Crosshair, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAvailabilityLabel, getLatestReportLabel, isUserReportsOnly } from "@/lib/availability-utils";

const CAMPUS_CENTER: [number, number] = [26.462647, -81.779026];

function getGarageStatusInfo(occupancyPercent: number | null) {
  if (occupancyPercent === null) return {
    text: "User Reports Only",
    markerBg: "bg-gray-400 text-white",
    pillBg: "bg-gray-100 text-gray-600",
  };
  if (occupancyPercent < 70) return {
    text: "Plenty of parking",
    markerBg: "bg-success text-success-foreground",
    pillBg: "bg-green-100 text-green-800"
  };
  if (occupancyPercent < 85) return {
    text: "Filling up",
    markerBg: "bg-warning text-warning-foreground",
    pillBg: "bg-yellow-100 text-yellow-800"
  };
  if (occupancyPercent < 95) return {
    text: "Almost full",
    markerBg: "bg-orange-500 text-white",
    pillBg: "bg-orange-100 text-orange-800"
  };
  return {
    text: "Full",
    markerBg: "bg-destructive text-destructive-foreground",
    pillBg: "bg-red-100 text-red-800"
  };
}

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function GarageMarker({
  garage,
  isSelected,
  onClick,
}: {
  garage: Garage;
  isSelected: boolean;
  onClick: () => void;
}) {
  const accessibleName = isUserReportsOnly(garage)
    ? `${garage.name}: User Reports Only, ${getAvailabilityLabel(garage)}`
    : `${garage.name}: ${garage.availableSpots} spaces available, ${getGarageStatusInfo(garage.occupancyPercent).text}`;
  const icon = useMemo(() => {
    const status = getGarageStatusInfo(garage.occupancyPercent);
    const scaleClass = isSelected ? 'scale-110 shadow-xl' : 'scale-100 shadow-md';
    const borderClass = isSelected ? 'border-[3px] border-white' : 'border-2 border-white';

    const html = `
      <div class="relative group transition-all duration-300 pointer-events-auto">
        <div class="w-[42px] h-[42px] rounded-full flex flex-col items-center justify-center ${borderClass} ${scaleClass} ${status.markerBg} z-10 relative">
          <span class="font-black text-[15px] leading-none tracking-tight">${isUserReportsOnly(garage) ? garage.shortName.match(/P[678]/i)?.[0] ?? "P" : garage.availableSpots}</span>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white transform rotate-45 z-0 shadow-sm ${isSelected ? 'scale-125' : ''}"></div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'bg-transparent border-none',
      iconSize: [42, 50],
      iconAnchor: [21, 50],
    });
  }, [garage, isSelected]);

  return (
    <Marker
      position={[garage.latitude, garage.longitude]}
      icon={icon}
      eventHandlers={{
        add: ({ target }) =>
          target.getElement()?.setAttribute("aria-label", accessibleName),
        click: onClick,
      }}
      alt={accessibleName}
      title={accessibleName}
      zIndexOffset={isSelected ? 1000 : 0}
    />
  );
}

function UserMarker({ location }: { location: { lat: number, lng: number } }) {
  const icon = useMemo(() => {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-8 h-8">
          <div class="absolute w-full h-full bg-blue-500 rounded-full opacity-30 animate-ping"></div>
          <div class="w-[18px] h-[18px] bg-blue-500 rounded-full border-[3px] border-white shadow-md z-10 relative"></div>
        </div>
      `,
      className: 'bg-transparent',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }, []);

  return <Marker position={[location.lat, location.lng]} icon={icon} zIndexOffset={500} />;
}

function MapEvents({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({ click: onMapClick });
  return null;
}

function MapController({
  selectedGarage,
  userLocation,
}: {
  selectedGarage?: Garage;
  userLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedGarage) {
      // Pan slightly down so marker isn't covered by bottom sheet
      map.setView([selectedGarage.latitude - 0.003, selectedGarage.longitude], 16, { animate: true });
    }
  }, [selectedGarage, map]);

  useEffect(() => {
    if (userLocation && !selectedGarage) {
      map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
    }
  }, [userLocation, selectedGarage, map]);

  return null;
}

export default function CampusMap() {
  const { data: garages, isLoading, isError } = useListGarages();
  const { data: summary, isError: summaryError } = useGetCampusSummary();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(null);

  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const filteredGarages = useMemo(() => {
    if (!garages) return [];
    if (!search) return garages;
    const lower = search.toLowerCase();
    return garages.filter(g =>
      g.name.toLowerCase().includes(lower) ||
      g.shortName.toLowerCase().includes(lower)
    );
  }, [garages, search]);

  const selectedGarage = useMemo(() =>
    garages?.find(g => g.id === selectedGarageId),
  [garages, selectedGarageId]);

  useEffect(() => {
    if (search.trim() && filteredGarages.length === 1) {
      setSelectedGarageId(filteredGarages[0].id);
    }
  }, [filteredGarages, search]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setSelectedGarageId(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. You can still browse every FGCU parking location."
            : "Your location is unavailable right now. You can still browse the campus map.";
        setLocationError(message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const distanceMiles = useMemo(() => {
    if (!selectedGarage || !userLocation) return null;
    return getDistanceMiles(
      userLocation.lat,
      userLocation.lng,
      selectedGarage.latitude,
      selectedGarage.longitude,
    ).toFixed(1);
  }, [userLocation, selectedGarage]);

  const statusInfo = selectedGarage ? getGarageStatusInfo(selectedGarage.occupancyPercent) : null;

  return (
    <AppLayout className="bg-[#E8F0F2] overflow-hidden relative">
      {/* Search Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-12 pointer-events-none">
        <div className="relative shadow-xl rounded-2xl bg-white border border-gray-100 pointer-events-auto transition-all">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campus..." 
            className="pl-11 pr-12 border-none shadow-none h-14 rounded-2xl text-[16px] font-medium bg-transparent focus-visible:ring-0 placeholder:text-gray-400"
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear map search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1.5 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={() => setLocation("/garages")}
              aria-label="View parking locations as a list"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-primary p-2 hover:bg-primary/5 rounded-xl transition-colors"
            >
              <List size={22} />
            </button>
          )}
        </div>
      </div>

      {/* Location Error Overlay */}
      {locationError && (
        <div className="absolute top-[104px] left-4 right-4 z-20 pointer-events-none">
          <div className="bg-white border-l-4 border-l-destructive text-gray-800 rounded-xl p-3.5 text-sm flex items-start gap-3 shadow-lg pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
            <span className="flex-1 font-medium leading-tight">{locationError}</span>
            <button
              onClick={() => setLocationError(null)}
              aria-label="Dismiss location message"
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {isError && (
        <div className="absolute top-[104px] left-4 right-4 z-20 rounded-xl border border-red-100 bg-white p-4 text-sm font-semibold text-red-700 shadow-lg">
          Parking locations could not be loaded. Please try again shortly.
        </div>
      )}

      {/* Map Surface */}
      <div className="absolute inset-0 z-0 bg-[#E8F0F2]">
        <MapContainer
          center={CAMPUS_CENTER}
          zoom={16}
          zoomControl={false}
          minZoom={14}
          maxZoom={19}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&amp;copy; &lt;a href="https://www.openstreetmap.org/copyright"&gt;OpenStreetMap&lt;/a&gt; contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ZoomControl position="topright" />
          <MapEvents onMapClick={() => setSelectedGarageId(null)} />
          <MapController selectedGarage={selectedGarage} userLocation={userLocation} />
          
          {!isLoading && filteredGarages?.map(garage => (
            <GarageMarker
              key={garage.id}
              garage={garage}
              isSelected={garage.id === selectedGarageId}
              onClick={() => setSelectedGarageId(garage.id)}
            />
          ))}

          {userLocation && <UserMarker location={userLocation} />}
        </MapContainer>
      </div>

      {/* Bottom Overlay Container */}
      <div className="absolute bottom-[80px] left-4 right-4 z-20 flex flex-col gap-4 pointer-events-none">
        {/* Controls */}
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={requestLocation}
            aria-label={userLocation ? "Center map on my location" : "Show my location"}
            title={userLocation ? "Center map on my location" : "Show my location"}
            className={cn(
              "w-[50px] h-[50px] rounded-full flex items-center justify-center shadow-xl border transition-all active:scale-95",
              isLocating ? "bg-primary/10 border-primary/20 text-primary animate-pulse" :
              userLocation ? "bg-primary text-primary-foreground border-primary shadow-primary/20" :
              "bg-white text-gray-600 border-gray-100 hover:text-primary"
            )}
          >
            <Crosshair size={22} />
          </button>
        </div>

        {/* Active Panel */}
        <div className="pointer-events-auto relative">
          {selectedGarage && statusInfo ? (
            <div className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 animate-in slide-in-from-bottom-8 duration-300">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">{selectedGarage.name}</h2>
                  <p className="text-[13px] font-medium text-gray-500 flex items-center gap-1.5 mt-1">
                    {selectedGarage.type === 'garage' ? 'Parking Garage' : 'Parking Lot'}
                    {distanceMiles && (
                      <>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span>{distanceMiles} mi away</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedGarageId(null)}
                  aria-label="Close parking details"
                  className="p-1.5 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-3 mb-4">
                {isUserReportsOnly(selectedGarage) ? (
                  <div className="w-full bg-gray-50 rounded-2xl p-3 border border-gray-100 text-center">
                    <p className="font-bold text-gray-600">{getLatestReportLabel(selectedGarage)}</p>
                    <p className="mt-1 text-xs text-gray-500">{getAvailabilityLabel(selectedGarage)}</p>
                  </div>
                ) : (
                <>
                <div className="flex-1 bg-gray-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-100/50">
                  <span className="text-2xl font-black text-gray-900 leading-none mb-1">{selectedGarage.availableSpots}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Available</span>
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-100/50">
                  <span className="text-2xl font-black text-gray-900 leading-none mb-1">{Math.round(selectedGarage.occupancyPercent ?? 0)}%</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full</span>
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-100/50">
                  <span className="text-2xl font-black text-gray-900 leading-none mb-1">{selectedGarage.totalSpots}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Capacity</span>
                </div>
                </>
                )}
              </div>

              <div className={cn("w-full py-2.5 px-3 rounded-xl flex items-center justify-center font-bold text-sm mb-5", statusInfo.pillBg)}>
                {statusInfo.text}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/garages/${selectedGarage.id}`}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-3.5 text-center text-[15px] font-bold text-gray-900 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  View Garage
                </Link>
                <Link
                  href={`/navigate/${selectedGarage.id}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <Navigation size={18} aria-hidden="true" /> Navigate
                </Link>
              </div>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-400 bg-gray-50/50 py-2 rounded-lg border border-gray-100/50">
                <Info size={12} />
                <span>{getAvailabilityLabel(selectedGarage)}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[24px] p-4 shadow-xl border border-gray-100 flex items-center justify-between animate-in slide-in-from-bottom-8 duration-300">
              <div className="flex items-center gap-4">
                <div className="w-[50px] h-[50px] bg-primary/10 rounded-2xl flex items-center justify-center">
                  <MapPin className="text-primary w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-gray-900 leading-tight">Campus Status</h3>
                  <p className="text-[13px] font-semibold text-gray-500 mt-0.5">
                    {summary ? (
                      <span className="text-success">{summary.openSpots} spots available</span>
                    ) : summaryError ? (
                      "Summary unavailable"
                    ) : (
                      "Loading..."
                    )}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {summary?.liveGaragesCount
                      ? `${summary.liveGaragesCount} live · ${summary.demoGaragesCount} awaiting live data`
                      : "Demo fallback · no verified live data"}
                  </p>
                </div>
              </div>

              <Link
                href="/garages"
                aria-label="View parking locations as a list"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <List size={22} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
