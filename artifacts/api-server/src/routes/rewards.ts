import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, parkingContributionsTable as contributions, userProfilesTable } from "@workspace/db";
import { authenticatedReporter, rewardLevel, summarizeRewards } from "../lib/parking-rewards";

const router: IRouter = Router();

router.get("/rewards/me", async (req, res) => {
  const userId = authenticatedReporter(req);
  if (!userId) { res.status(401).json({ error: "Sign in to view rewards." }); return; }
  const rows = await db.select().from(contributions).where(eq(contributions.userId, userId));
  res.json(summarizeRewards(rows));
});

router.get("/rewards/leaderboard", async (_req, res) => {
  const points = sql<number>`cast(sum(${contributions.basePoints} + ${contributions.bonusPoints}) as integer)`;
  const rows = await db.select({
    firstName: userProfilesTable.firstName, lastName: userProfilesTable.lastName,
    totalPoints: points, validReports: sql<number>`cast(count(*) as integer)`,
  }).from(contributions)
    .innerJoin(userProfilesTable, eq(contributions.userId, userProfilesTable.userId))
    .groupBy(userProfilesTable.userId, userProfilesTable.firstName, userProfilesTable.lastName)
    .having(sql`sum(${contributions.basePoints} + ${contributions.bonusPoints}) > 0`)
    .orderBy(desc(points), userProfilesTable.firstName, userProfilesTable.userId).limit(20);
  res.json(rows.map((row, index) => ({
    rank: index + 1,
    name: `${row.firstName?.trim().split(/\s+/)[0] || "Student"}${row.lastName?.trim() ? ` ${Array.from(row.lastName.trim())[0]}.` : ""}`,
    totalPoints: row.totalPoints, validReports: row.validReports, level: rewardLevel(row.totalPoints),
  })));
});

export default router;
