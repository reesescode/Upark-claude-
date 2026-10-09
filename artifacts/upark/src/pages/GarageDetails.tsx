import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetGarage,
  getGetGarageQueryKey,
  getListGaragesQueryKey,
  getGetCampusSummaryQueryKey,
  useListParkingReports,
  useCreateParkingReport,
  useFlagParkingReportNote,
  useGetMyRewards,
  getGetMyRewardsQueryKey,
  getGetRewardsLeaderboardQueryKey,
  getGetUserProfileQueryKey,
  getListParkingReportsQueryKey,
  type ParkingReport,
  type ParkingReportInputAvailabilityStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ParkingReportNote } from "@/components/ParkingReportNote";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronLeft, Navigation, Heart, Clock, DollarSign, Info, MapPin, Map as MapIcon, Footprints, MessageSquarePlus, CheckCircle2, Loader2 } from "lucide-react";
import { getStatusColor, getStatusText, getStatusColorSolid } from "@/lib/garage-utils";
import { useFavorites, useUser } from "@/hooks/use-local-data";
import { cn } from "@/lib/utils";
import { getAvailabilityLabel, getLatestReportLabel, isUserReportsOnly } from "@/lib/availability-utils";
import { getReportLocation } from "@/lib/report-location";

const reportOptions: Array<{
  value: ParkingReportInputAvailabilityStatus;
  label: string;
  color: string;
}> = [
  { value: "plenty_spots", label: "Plenty of Spots", color: "bg-green-500" },
  { value: "filling_up", label: "Filling Up", color: "bg-amber-500" },
  { value: "almost_full", label: "Almost Full", color: "bg-orange-500" },
  { value: "full", label: "Full", color: "bg-red-500" },
];

const reportLabels: Record<ParkingReport["availabilityStatus"], string> = {
  plenty_spots: "Plenty of Spots",
  filling_up: "Filling Up",
  almost_full: "Almost Full",
  full: "Full",
};

const reportColors: Record<ParkingReport["availabilityStatus"], string> = {
  plenty_spots: "bg-green-50 text-green-700 border-green-100",
  filling_up: "bg-amber-50 text-amber-700 border-amber-100",
  almost_full: "bg-orange-50 text-orange-700 border-orange-100",
  full: "bg-red-50 text-red-700 border-red-100",
};

function getReportErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "error" in error.data &&
    typeof error.data.error === "string"
  ) {
    return error.data.error;
  }

  return error instanceof Error
    ? error.message
    : "Unable to submit your report. Please try again.";
}

function formatReportedTime(createdAt: string) {
  const created = new Date(createdAt);
  if (Date.now() - created.getTime() < 60_000) return "reported just now";
  return `reported ${formatDistanceToNow(created, { addSuffix: true })}`;
}

export default function GarageDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: garage, isLoading, isError } = useGetGarage(id!, { query: { queryKey: getGetGarageQueryKey(id!), refetchInterval: 60_000 } });
  const {
    data: reports,
    isLoading: reportsLoading,
    isError: reportsError,
  } = useListParkingReports(id!, { query: { queryKey: getListParkingReportsQueryKey(id!), refetchInterval: 60_000, staleTime: 0 } });
  const createReport = useCreateParkingReport();
  const flagNote = useFlagParkingReportNote();
  const [note, setNote] = useState("");
  const [flagFeedback, setFlagFeedback] = useState<{ reportId: number; message: string; error: boolean } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<ParkingReportInputAvailabilityStatus | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  
  const [, setLocation] = useLocation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useUser();
  const { data: rewards, isError: rewardsError } = useGetMyRewards({ query: { queryKey: getGetMyRewardsQueryKey(), enabled: !!user, refetchInterval: 60_000, staleTime: 0 } });

  const handleSubmitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setReportError(null);
    setReportSuccess(false);

    if (!selectedStatus) {
      setReportError("Select a parking status before submitting.");
      return;
    }
    if (!user?.studentId) {
      setReportError("Please sign in from the welcome screen before reporting.");
      return;
    }

    if (!garage || checkingLocation || createReport.isPending) return;
    setCheckingLocation(true);
    let location;
    try {
      location = await getReportLocation(garage);
    } catch (error) {
      setReportError(getReportErrorMessage(error));
      setCheckingLocation(false);
      return;
    }
    setCheckingLocation(false);
    createReport.mutate(
      {
        garageId: id!,
        data: {
          location,
          availabilityStatus: selectedStatus,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      },
      {
        onSuccess: (newReport) => {
          queryClient.setQueryData<ParkingReport[]>(
            getListParkingReportsQueryKey(id!),
            (current = []) => [newReport, ...current].slice(0, 20),
          );
          queryClient.invalidateQueries({
            queryKey: getGetGarageQueryKey(id!),
          });
          queryClient.invalidateQueries({
            queryKey: getListGaragesQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetCampusSummaryQueryKey(),
          });
          queryClient.invalidateQueries({ queryKey: getGetMyRewardsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRewardsLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(user.studentId) });
          setPointsEarned(newReport.pointsEarned ?? 0);
          setReportSuccess(true);
          setReportOpen(false);
          setSelectedStatus(null);
          setNote("");
        },
        onError: (error) => {
          setReportError(getReportErrorMessage(error));
        },
      },
    );
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
    <Dialog
      open={reportOpen}
      onOpenChange={(open) => {
        if (createReport.isPending || checkingLocation) return;
        if (open) {
          setReportError(null);
          setSelectedStatus("plenty_spots");
        }
        setReportOpen(open);
      }}
    >
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
            {isUserReportsOnly(garage) ? "User Reports Only" : getStatusText(garage.status)}
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
          {isUserReportsOnly(garage) ? (
            <div>
              <p className="text-sm font-bold text-gray-500">User Reports Only</p>
              <p className="text-2xl font-black text-gray-700 mt-2">{getLatestReportLabel(garage)}</p>
              <p className="mt-3 text-sm text-gray-500">{getAvailabilityLabel(garage)}</p>
              <p className="mt-2 text-xs text-gray-500">Student updates expire after 30 minutes. Live space counts are not available for this lot.</p>
            </div>
          ) : (
          <>
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
              style={{ width: `${Math.min(garage.occupancyPercent ?? 0, 100)}%` }}
            />
          </div>
          <p
            className={cn(
              "mt-4 rounded-xl px-3 py-2 text-xs font-semibold",
              garage.availabilitySource === "demo"
                ? "bg-gray-100 text-gray-600"
                : garage.availabilityIsStale
                  ? "bg-amber-50 text-amber-800"
                  : "bg-green-50 text-green-800",
            )}
          >
            {getAvailabilityLabel(garage)}
          </p>
          </>
          )}
        </div>

        {reportSuccess && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-green-800"
          >
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="font-bold">Parking report submitted! {pointsEarned > 0 ? `+${pointsEarned} points` : "Daily reward limit reached."}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center flex-shrink-0">
              <MessageSquarePlus size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">How is parking right now?</h2>
              <p className="text-sm text-gray-500 mt-1">
                Help other students find a spot.
                {user && <span className="block mt-1">{rewards ? `${rewards.reportsRemainingToday} of 2 rewarded reports left today.` : rewardsError ? "Rewards unavailable right now." : "Loading rewards..."}</span>}
              </p>
            </div>
          </div>
          <DialogTrigger asChild>
            <Button className="w-full h-12 rounded-2xl mt-4 gap-2">
              <MessageSquarePlus size={19} />
              Report Parking
            </Button>
          </DialogTrigger>
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

        <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Parking Reports</h2>
            <p className="text-sm text-gray-500 mt-1">
              Submitted by students for this garage
            </p>
          </div>

          {reportsLoading && (
            <div className="space-y-3" aria-label="Loading parking reports">
              {[0, 1].map((item) => (
                <div key={item} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {reportsError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
              Recent reports could not be loaded. Please try again.
            </div>
          )}

          {!reportsLoading && !reportsError && reports?.length === 0 && (
            <div className="rounded-2xl bg-gray-50 p-5 text-center">
              <p className="font-semibold text-gray-700">No reports yet</p>
              <p className="text-sm text-gray-500 mt-1">Be the first to report parking here.</p>
            </div>
          )}

          {!reportsLoading && !reportsError && reports && reports.length > 0 && (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl bg-gray-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex rounded-xl border px-3 py-1.5 text-sm font-bold",
                      reportColors[report.availabilityStatus],
                    )}
                  >
                    {reportLabels[report.availabilityStatus]}
                  </span>
                  <span className="text-xs font-medium text-gray-500 text-right">
                    {formatReportedTime(report.createdAt)}
                  </span>
                  </div>
                  {report.note && (
                    <ParkingReportNote
                      note={report.note}
                      emergency={report.noteEmergency ?? false}
                      pending={flagNote.isPending && flagNote.variables?.reportId === report.id}
                      feedback={flagFeedback?.reportId === report.id ? flagFeedback : null}
                      onFlag={() => {
                        setFlagFeedback(null);
                        if (!user) {
                          setFlagFeedback({ reportId: report.id, message: "Sign in to flag a note.", error: true });
                          return;
                        }
                        flagNote.mutate({ garageId: id!, reportId: report.id }, {
                          onSuccess: (result) => setFlagFeedback({ reportId: report.id, message: result.message, error: false }),
                          onError: (error) => setFlagFeedback({ reportId: report.id, message: getReportErrorMessage(error), error: true }),
                        });
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border-0 p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="text-2xl font-black text-gray-900">
              Report Parking
            </DialogTitle>
            <DialogDescription>
              {garage.name}. Location access is required; you must be within 100 meters. Reports expire after 30 minutes.
              {rewards && <span className="block mt-2">{rewards.reportsRemainingToday} rewarded reports left today · resets at midnight Eastern. {rewards.reportsRemainingToday === 0 ? "You can still report without earning points." : "Earn 10 points, plus 5 when another student confirms."}</span>}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitReport}>
            <fieldset className="mt-6 space-y-3">
              <legend className="text-sm font-bold text-gray-700 mb-3">
                What does availability look like?
              </legend>
              {reportOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-colors",
                    selectedStatus === option.value
                      ? "border-primary bg-blue-50"
                      : "border-gray-100 bg-white",
                  )}
                >
                  <input
                    type="radio"
                    name="availabilityStatus"
                    value={option.value}
                    checked={selectedStatus === option.value}
                    onChange={() => {
                      setSelectedStatus(option.value);
                      setReportError(null);
                    }}
                    className="sr-only"
                  />
                  <span className={cn("h-3 w-3 rounded-full", option.color)} />
                  <span className="font-bold text-gray-900">{option.label}</span>
                  <span
                    className={cn(
                      "ml-auto h-5 w-5 rounded-full border-2",
                      selectedStatus === option.value
                        ? "border-primary bg-primary shadow-[inset_0_0_0_4px_white]"
                        : "border-gray-300",
                    )}
                  />
                </label>
              ))}
            </fieldset>

            <div className="mt-5">
              <label htmlFor="parking-note" className="block text-sm font-bold text-gray-700 mb-2">
                Add a note (optional)
              </label>
              <Textarea
                id="parking-note"
                value={note}
                onChange={(event) => { setNote(event.target.value); setReportError(null); }}
                maxLength={100}
                rows={3}
                className="rounded-2xl border-gray-200 bg-white resize-none"
                placeholder="e.g. Spot opening up near the stairs."
                aria-describedby="parking-note-help parking-note-count"
                disabled={createReport.isPending || checkingLocation}
              />
              <div className="mt-2 flex justify-between gap-3 text-xs text-gray-500">
                <p id="parking-note-help">Keep updates appropriate and helpful. No personal contact details.</p>
                <span id="parking-note-count" className="shrink-0 tabular-nums" aria-live="polite">{note.length}/100</span>
              </div>
            </div>

            {reportError && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700"
              >
                {reportError}
              </div>
            )}

            <Button
              type="submit"
              className="mt-6 h-14 w-full rounded-2xl text-base gap-2"
              disabled={createReport.isPending || checkingLocation}
            >
              {(createReport.isPending || checkingLocation) && <Loader2 size={19} className="animate-spin" />}
              {checkingLocation ? "Checking location..." : createReport.isPending ? "Submitting..." : "Verify Location & Submit"}
            </Button>
          </form>
      </DialogContent>

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
    </Dialog>
  );
}
