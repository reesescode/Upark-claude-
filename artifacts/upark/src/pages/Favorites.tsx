import { AppLayout } from "@/components/layout/AppLayout";
import { useListGarages } from "@workspace/api-client-react";
import { GarageCard } from "@/components/GarageCard";
import { useFavorites } from "@/hooks/use-local-data";
import { Heart, Search } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

export default function Favorites() {
  const { data: garages, isLoading } = useListGarages();
  const { favorites } = useFavorites();

  const favoriteGarages = useMemo(() => {
    if (!garages) return [];
    return garages.filter(g => favorites.includes(g.id));
  }, [garages, favorites]);

  return (
    <AppLayout>
      <div className="bg-white pt-12 pb-4 px-4 sticky top-0 z-20 border-b border-gray-100 shadow-sm">
        <h1 className="text-2xl font-black text-gray-900">Your Favorites</h1>
      </div>

      <div className="p-4 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-40 bg-white rounded-2xl animate-pulse shadow-xs border border-gray-100"></div>
            ))}
          </div>
        )}

        {!isLoading && favoriteGarages.length === 0 && (
          <div className="text-center p-12 mt-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="text-red-400 w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No favorites yet</h3>
            <p className="text-gray-500 text-sm mb-8 max-w-[200px] mx-auto">
              Save your most used garages for quick access to live availability.
            </p>
            <Link href="/garages">
              <Button className="rounded-xl px-8 shadow-md hover-elevate">Find Garages</Button>
            </Link>
          </div>
        )}

        {!isLoading && favoriteGarages.map(garage => (
          <GarageCard key={garage.id} garage={garage} />
        ))}
      </div>
    </AppLayout>
  );
}
