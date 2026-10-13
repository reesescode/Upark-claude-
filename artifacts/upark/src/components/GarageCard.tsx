import { Garage } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ChevronRight, Heart, MapPin } from "lucide-react";
import { getStatusColor, getStatusText } from "@/lib/garage-utils";
import { useFavorites } from "@/hooks/use-local-data";
import { cn } from "@/lib/utils";
import { getAvailabilityLabel, getLatestReportLabel, isUserReportsOnly } from "@/lib/availability-utils";

interface GarageCardProps {
  garage: Garage;
}

export function GarageCard({ garage }: GarageCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(garage.id);
  const reportsOnly = isUserReportsOnly(garage);

  return (
    <Link href={`/garages/${garage.id}`} className="block">
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 active:scale-[0.98] transition-all hover-elevate">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className={cn("flex items-center gap-2 mb-1", reportsOnly && "flex-wrap")}>
              <span className="font-bold text-lg text-gray-900 tracking-tight">{garage.name}</span>
              <div className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", getStatusColor(garage.status))}>
                {reportsOnly ? "User Reports Only" : getStatusText(garage.status)}
              </div>
            </div>
            <p className="text-gray-500 text-sm flex items-center gap-1">
              <MapPin size={14} />
              <span className="truncate max-w-[200px]">{garage.address}</span>
            </p>
          </div>
          <button 
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite(garage.id);
            }}
            className="p-2 -mr-2 -mt-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all"
          >
            {favorite ? <Heart size={22} className="text-red-500 fill-red-500" /> : <Heart size={22} />}
          </button>
        </div>

        <div className="flex items-end justify-between mt-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className={reportsOnly ? "text-sm font-bold text-gray-600 leading-tight" : "text-2xl font-black text-gray-900 leading-none"}>
                {reportsOnly ? getLatestReportLabel(garage) : garage.availableSpots}
              </span>
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                {reportsOnly ? "Student Update" : "Spots Open"}
              </span>
            </div>
            
          </div>
          
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
            <ChevronRight size={18} strokeWidth={3} />
          </div>
        </div>
        <p
          className={cn(
            "mt-3 border-t border-gray-100 pt-3 text-xs font-semibold",
            garage.availabilitySource === "demo" || reportsOnly
              ? "text-gray-500"
              : garage.availabilityIsStale
                ? "text-amber-700"
                : "text-green-700",
          )}
        >
          {getAvailabilityLabel(garage)}
        </p>
      </div>
    </Link>
  );
}
