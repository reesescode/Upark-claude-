import { Link } from "wouter";
import { ChevronLeft, Trophy } from "lucide-react";
import { useGetRewardsLeaderboard, getGetRewardsLeaderboardQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export default function Leaderboard() {
  const { data, isLoading, isError, refetch } = useGetRewardsLeaderboard({
    query: { queryKey: getGetRewardsLeaderboardQueryKey(), refetchInterval: 60000, staleTime: 30000 },
  });

  return (
    <AppLayout>
      <div className="bg-white pt-12 pb-4 px-4 sticky top-0 z-20 border-b border-gray-100 shadow-sm flex items-center gap-3 h-[88px]">
        <Link
          href="/profile"
          data-testid="link-back-profile"
          aria-label="Back to Profile"
          className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-black text-gray-900">Leaderboard</h1>
      </div>

      <div className="p-4">
        {isLoading && (
          <div className="space-y-3" data-testid="status-leaderboard-loading">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-3xl bg-gray-50 animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs text-center space-y-3" data-testid="status-leaderboard-error">
            <p className="text-gray-500">Could not load the leaderboard.</p>
            <Button variant="outline" onClick={() => void refetch()} data-testid="button-retry-leaderboard">Retry</Button>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xs text-center" data-testid="status-leaderboard-empty">
            <Trophy className="mx-auto text-gray-300 mb-2" size={32} />
            <h2 className="font-bold text-gray-900">No rankings yet</h2>
            <p className="text-sm text-gray-500 mt-1">Submit a valid parking report to get on the board.</p>
          </div>
        )}

        {data && data.length > 0 && (
          <ol className="bg-white rounded-3xl shadow-xs border border-gray-100 overflow-hidden">
            {data.map((e) => (
              <li key={e.rank} className="p-4 flex items-center gap-3 border-b border-gray-50 last:border-0" data-testid={`row-leaderboard-${e.rank}`}>
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 font-black text-gray-700 shrink-0">{e.rank}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{e.name}</p>
                  <p className="text-xs text-gray-500">{e.level} · {e.validReports} valid reports</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-gray-900">{e.totalPoints}</p>
                  <p className="text-xs text-gray-500">points</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppLayout>
  );
}
