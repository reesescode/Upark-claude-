import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListGarages, useGetCampusSummary } from "@workspace/api-client-react";
import { Search, MapPin, Navigation, Info, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { getStatusColorSolid } from "@/lib/garage-utils";
import { cn } from "@/lib/utils";

export default function CampusMap() {
  const { data: garages } = useListGarages();
  const { data: summary } = useGetCampusSummary();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  // Mock mapping lat/lng to percentage coordinates for our dummy map
  const getMarkerStyle = (lat: number, lng: number) => {
    // These specific formulas just spread our dummy data across the screen reasonably well
    const top = `${Math.abs((lat % 0.02) / 0.02) * 80 + 10}%`;
    const left = `${Math.abs((lng % 0.02) / 0.02) * 80 + 10}%`;
    return { top, left };
  };

  return (
    <AppLayout className="bg-[#E8F0F2]">
      {/* Search Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-12 bg-gradient-to-b from-white/90 to-transparent">
        <div className="relative shadow-lg rounded-2xl bg-white">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campus..." 
            className="pl-11 border-none shadow-none h-14 rounded-2xl text-base bg-transparent focus-visible:ring-0"
          />
          <button 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-primary p-2"
            onClick={() => setLocation("/garages")}
          >
            <List size={20} />
          </button>
        </div>
      </div>

      {/* Map Surface (Mock) */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#e0e7df]">
        {/* Decorative paths simulating roads */}
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <path d="M-100 200 Q 200 100 300 400 T 500 100" stroke="#fff" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d="M100 -100 Q 150 300 400 400 T 600 600" stroke="#fff" strokeWidth="16" fill="none" strokeLinecap="round" />
          <path d="M-50 500 Q 300 500 500 700" stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" />
        </svg>
        
        {/* Buildings (Mock) */}
        <div className="absolute top-[20%] left-[20%] w-32 h-32 bg-gray-200 rounded-lg shadow-sm border border-white/50 transform rotate-12"></div>
        <div className="absolute top-[60%] left-[60%] w-40 h-24 bg-gray-200 rounded-lg shadow-sm border border-white/50 transform -rotate-6"></div>
        <div className="absolute top-[30%] left-[70%] w-24 h-48 bg-gray-200 rounded-lg shadow-sm border border-white/50 transform rotate-3"></div>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <MapPin size={400} />
        </div>
      </div>

      {/* Markers */}
      <div className="absolute inset-0 z-10">
        {garages?.map(garage => {
          // If searching, hide non-matches
          if (search && !garage.name.toLowerCase().includes(search.toLowerCase()) && !garage.shortName.toLowerCase().includes(search.toLowerCase())) {
            return null;
          }
          
          return (
            <button
              key={garage.id}
              onClick={() => setLocation(`/garages/${garage.id}`)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group hover:z-50 active:scale-95 transition-transform"
              style={getMarkerStyle(garage.latitude, garage.longitude)}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-white rounded-xl shadow-lg border border-gray-100 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <p className="font-bold text-gray-900 text-sm mb-0.5">{garage.shortName}</p>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", getStatusColorSolid(garage.status))} />
                  <span className="text-xs font-semibold text-gray-600">{garage.availableSpots} open</span>
                </div>
              </div>
              
              {/* Pin */}
              <div className="relative">
                <div className={cn(
                  "w-12 h-12 rounded-full flex flex-col items-center justify-center text-white shadow-md border-2 border-white transform transition-transform group-hover:scale-110 group-hover:-translate-y-2",
                  getStatusColorSolid(garage.status)
                )}>
                  <span className="font-black text-sm leading-none">{garage.availableSpots}</span>
                </div>
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white transform rotate-45 -z-10 shadow-sm"></div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary Widget */}
      <div className="absolute bottom-[80px] left-4 right-4 z-20">
        <div className="bg-white rounded-3xl p-4 shadow-xl border border-gray-100 flex items-center justify-between animate-in slide-in-from-bottom-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <MapPin className="text-primary w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">Campus Status</h3>
              <p className="text-sm font-medium text-gray-500">
                {summary ? (
                  <span className="text-green-600 font-bold">{summary.openSpots} spots available</span>
                ) : (
                  "Loading..."
                )}
              </p>
            </div>
          </div>
          
          <Link href="/garages">
            <button className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <Navigation size={20} />
            </button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
