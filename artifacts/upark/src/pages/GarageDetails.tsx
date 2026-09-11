import { useParams, Link, useLocation } from "wouter";
import { useGetGarage, useUpdateGarageAvailability, getGetGarageQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Navigation, Heart, Clock, DollarSign, Info, MapPin, Map as MapIcon, Footprints, AlertTriangle } from "lucide-react";
import { getStatusColor, getStatusText, getStatusColorSolid } from "@/lib/garage-utils";
import { useFavorites } from "@/hooks/use-local-data";
import { cn } from "@/lib/utils";

export default function GarageDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: garage, isLoading, isError } = useGetGarage(id!);
  const updateAvailability = useUpdateGarageAvailability();
  
  const [, setLocation] = useLocation();
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleReportFull = () => {
    if (!garage) return;
    updateAvailability.mutate({
      garageId: garage.id,
      data: {
        availableSpots: Math.max(0, garage.availableSpots - 10), // dummy update
        totalSpots: garage.totalSpots
      }
    }, {
      onSuccess: (updatedGarage) => {
        // Optimistic UI update patch without triggering waterfall refetch
        queryClient.setQueryData(getGetGarageQueryKey(garage.id), updatedGarage);
      }
    });
  };

  if (isLoading) {
    return (
      <AppLayout showNav={false} className="bg-white">
        <div className="animate-pulse h-[300px] bg-gray-200 w-full" />
        <div className="p-6 space-y-4">
          <div className="h-8 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-200 rounded-3xl w-full mt-8" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !garage) {
    return (
      <AppLayout showNav={false}>
        <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
          <h2 className="text-xl font-bold mb-2">Garage Not Found</h2>
          <Button variant="outline" onClick={() => setLocation("/garages")}>
            Go Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  const favorite = isFavorite(garage.id);

  return (
    <AppLayout showNav={false} className="bg-gray-50 pb-28">
      {/* Header / Map placeholder */}
      <div className="relative h-[250px] bg-gray-200 w-full overflow-hidden">
        {/* Mock map background */}
        <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPgo8cGF0aCBkPSJNMCAwbDQwIDQwbS00MCAwaDQwbS00MC00MHY0MG0yMC00MHY0MG0tMjAtMjBoNDAiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLW9wYWNpdHk9Ii4xIi8+Cjwvc3ZnPg==')] bg-repeat" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
        
        {/* Top actions */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-12 flex justify-between items-center z-10">
          <button 
            onClick={() => window.history.back()}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 active:scale-90 transition-transform"
          >
            <ChevronLeft size={24} />
          </button>
          
          <button 
            onClick={() => toggleFavorite(garage.id)}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 active:scale-90 transition-transform"
          >
            {favorite ? <Heart size={22} className="fill-red-500 text-red-500" /> : <Heart size={22} />}
          </button>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-4 left-4 right-4 text-white z-10">
          <div className={cn("inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider mb-2", getStatusColorSolid(garage.status), "text-white")}>
            {getStatusText(garage.status)}
          </div>
          <h1 className="text-3xl font-black tracking-tight leading-tight">{garage.name}</h1>
          <p className="text-white/80 text-sm flex items-center gap-1.5 mt-1 font-medium">
            <MapPin size={14} /> {garage.address}
          </p>
        </div>
      </div>

      <div className="px-4 py-6 -mt-4 relative z-20 space-y-6">
        {/* Main Stats Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Availability</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-gray-900 leading-none">{garage.availableSpots}</span>
                <span className="text-lg font-bold text-gray-400">/ {garage.totalSpots}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-900">{garage.occupancyPercent}%</span>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Full</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-3 bg-gray-100 rounded-full mt-6 overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", getStatusColorSolid(garage.status))}
              style={{ width: `${Math.min(garage.occupancyPercent, 100)}%` }}
            />
          </div>

          <button 
            onClick={handleReportFull}
            disabled={updateAvailability.isPending}
            className="absolute top-4 right-4 text-xs font-bold flex items-center gap-1 text-gray-400 hover:text-gray-600 active:scale-95"
          >
            <AlertTriangle size={14} />
            Report Less Spots
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center text-center justify-center">
            <div className="w-12 h-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mb-3">
              <Clock size={24} />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Drive Time</span>
            <span className="text-lg font-bold text-gray-900">{garage.driveTimeMinutes} min</span>
          </div>
          
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center text-center justify-center">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-3">
              <Footprints size={24} />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Walk to Class</span>
            <span className="text-lg font-bold text-gray-900">{garage.walkingTimeMinutes} min</span>
          </div>
        </div>

        {/* Details List */}
        <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
          <div className="p-4 flex items-start gap-4 border-b border-gray-50">
            <div className="mt-0.5"><Clock className="text-gray-400" size={20} /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Hours</p>
              <p className="text-sm text-gray-500">{garage.openHours}</p>
            </div>
          </div>
          <div className="p-4 flex items-start gap-4 border-b border-gray-50">
            <div className="mt-0.5"><DollarSign className="text-gray-400" size={20} /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Rates</p>
              <p className="text-sm text-gray-500">{garage.price}</p>
            </div>
          </div>
          <div className="p-4 flex items-start gap-4">
            <div className="mt-0.5"><Info className="text-gray-400" size={20} /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Permits Accepted</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {garage.permits.map(permit => (
                  <span key={permit} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-md uppercase">
                    {permit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe-8 bg-gradient-to-t from-white via-white to-transparent pt-8 z-30">
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="outline" className="w-16 h-16 rounded-2xl flex-shrink-0 bg-white" onClick={() => setLocation("/map")}>
            <MapIcon size={24} className="text-gray-700" />
          </Button>
          <Link href={`/navigate/${garage.id}`} className="flex-1">
            <Button size="lg" className="w-full h-16 text-lg rounded-2xl gap-2 shadow-lg shadow-primary/25 hover-elevate">
              <Navigation size={22} className="fill-white" />
              Navigate Here
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
