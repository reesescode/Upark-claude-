import { useState, useMemo, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListGarages, useGetUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { GarageCard } from "@/components/GarageCard";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { Garage } from "@workspace/api-client-react";
import { useUser } from "@/hooks/use-local-data";

type SortOption = "nearest" | "most_available" | "least_full";

export default function Garages() {
  const { user } = useUser();
  const { data: profile } = useGetUserProfile(user?.studentId || "", {
    query: {
      enabled: !!user?.studentId,
      queryKey: getGetUserProfileQueryKey(user?.studentId || ""),
    },
  });

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("nearest");
  const initSortDone = useRef(false);

  // Update sort when profile loads (only once)
  useEffect(() => {
    if (profile?.preferences?.defaultParkingPreference && !initSortDone.current) {
      initSortDone.current = true;
      const pref = profile.preferences.defaultParkingPreference;
      if (pref === "closest") setSort("nearest");
      else if (pref === "most_available") setSort("most_available");
      else if (pref === "lowest_occupancy") setSort("least_full");
    }
  }, [profile?.preferences?.defaultParkingPreference]);

  const { data: garages, isLoading, isError } = useListGarages();

  const filteredAndSortedGarages = useMemo(() => {
    if (!garages) return [];

    let result = [...garages];

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.shortName.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sort === "nearest") {
        return a.distanceMiles - b.distanceMiles;
      } else if (sort === "most_available") {
        return (b.availableSpots ?? -1) - (a.availableSpots ?? -1);
      } else if (sort === "least_full") {
        return (a.occupancyPercent ?? 101) - (b.occupancyPercent ?? 101);
      }
      return 0;
    });

    return result;
  }, [garages, search, sort]);

  return (
    <AppLayout>
      <div className="bg-primary pt-12 pb-6 px-4 rounded-b-[2rem] shadow-sm sticky top-0 z-20">
        <h1 className="text-3xl font-black text-white mb-6">Find Parking</h1>

        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search garages or lots..."
              className="pl-11 border-none shadow-sm h-14 rounded-2xl text-base"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
          <SortChip
            active={sort === "nearest"}
            onClick={() => setSort("nearest")}
            label="Nearest to me"
          />
          <SortChip
            active={sort === "most_available"}
            onClick={() => setSort("most_available")}
            label="Most Open Spots"
          />
          <SortChip
            active={sort === "least_full"}
            onClick={() => setSort("least_full")}
            label="Least Full"
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white rounded-2xl animate-pulse shadow-xs border border-gray-100"></div>
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center p-8 bg-red-50 rounded-2xl text-red-600 mt-4">
            <p className="font-semibold">Failed to load garages</p>
            <p className="text-sm opacity-80 mt-1">Please try again later.</p>
          </div>
        )}

        {!isLoading && !isError && filteredAndSortedGarages.length === 0 && (
          <div className="text-center p-12 mt-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-400" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No garages found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your search terms.</p>
          </div>
        )}

        {!isLoading && !isError && filteredAndSortedGarages.map(garage => (
          <GarageCard key={garage.id} garage={garage} />
        ))}
      </div>
    </AppLayout>
  );
}

function SortChip({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border ${
        active
          ? "bg-white text-primary border-transparent shadow-sm"
          : "bg-primary/20 text-white border-primary/30 hover:bg-primary/30"
      }`}
    >
      {label}
    </button>
  );
}
