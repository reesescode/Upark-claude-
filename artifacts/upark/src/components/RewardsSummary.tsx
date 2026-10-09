import { Link } from "wouter";
import { Trophy, Flame, FileText, Star, ChevronRight } from "lucide-react";
import { useGetMyRewards, getGetMyRewardsQueryKey } from "@workspace/api-client-react";
import { useUser } from "@/hooks/use-local-data";
import { Button } from "@/components/ui/button";

export function RewardsSummary() {
  const { user } = useUser();
  const signedIn = !!user;
  const { data, isLoading, isError, refetch } = useGetMyRewards({
    query: {
      enabled: signedIn,
      queryKey: getGetMyRewardsQueryKey(),
      refetchInterval: 60000,
      staleTime: 30000,
    },
  });

  const stats = data
    ? [
        { label: "Total points", value: data.totalPoints, icon: <Star size={16} className="text-gray-500" /> },
        { label: "Valid reports", value: data.validReports, icon: <FileText size={16} className="text-gray-500" /> },
        { label: "Current streak", value: data.currentStreak, icon: <Flame size={16} className="text-gray-500" /> },
        { label: "Rewards left today", value: data.reportsRemainingToday, icon: <Trophy size={16} className="text-gray-500" /> },
      ]
    : [];

  return (
    <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 mb-6" data-testid="card-rewards">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900">Rewards</h3>
        {data && (
          <span className="bg-gray-50 text-gray-700 px-2.5 py-1 rounded-full text-xs font-bold" data-testid="text-rewards-level">
            {data.level}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-50 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-sm text-gray-500 space-y-3" data-testid="status-rewards-error">
          <p>Could not load your rewards.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} data-testid="button-retry-rewards">Retry</Button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">{s.icon}{s.label}</div>
              <p className="text-2xl font-black text-gray-900 mt-1" data-testid={`text-rewards-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <ul className="text-sm text-gray-500 space-y-1.5 mt-4 list-disc pl-5">
        <li>Earn 10 points per valid report, plus a one-time 5-point bonus when another student confirms it.</li>
        <li>Up to 2 rewarded reports per day.</li>
        <li>Your daily limit resets at midnight Eastern.</li>
        <li>Reports stay active for 30 minutes.</li>
      </ul>

      <Link
        href="/leaderboard"
        data-testid="link-leaderboard"
        className="mt-4 flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2"><Trophy size={18} className="text-gray-500" />View leaderboard</span>
        <ChevronRight className="text-gray-300" size={20} />
      </Link>
    </div>
  );
}
