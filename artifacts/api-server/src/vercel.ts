/**
 * Vercel entrypoint. Vercel runs the API as a function that handles requests
 * rather than a long-lived server, so there is no app.listen() and no
 * background timer. Instead, the official FGCU feed is refreshed at most once
 * per interval, triggered by incoming requests.
 */
import express, { type Express } from "express";
import app from "./app";
import { logger } from "./lib/logger";
import { syncOfficialParkingAvailability } from "./lib/official-parking-feed";

const SYNC_INTERVAL_MS = 60_000;
let lastSyncStartedAt = 0;
let syncInProgress = false;

function maybeSyncOfficialFeed() {
  const now = Date.now();
  if (syncInProgress || now - lastSyncStartedAt < SYNC_INTERVAL_MS) return;
  syncInProgress = true;
  lastSyncStartedAt = now;
  syncOfficialParkingAvailability()
    .then((result) =>
      logger.info(result, "Synced official FGCU parking availability"),
    )
    .catch((err) =>
      logger.warn({ err }, "Official FGCU parking sync failed"),
    )
    .finally(() => {
      syncInProgress = false;
    });
}

const server: Express = express();
server.use((_req, _res, next) => {
  maybeSyncOfficialFeed();
  next();
});
server.use(app);

export default server;
