/**
 * nsImport router — split across files by domain and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.nsImport.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - verification: nation ownership verification flow (verifyNation, requestVerification,
 *                  checkVerification, hasImported)
 *  - decks:        single-nation deck operations (fetchPublicDeck, previewDeck, importDeck)
 *  - sync:         admin bulk-region sync control plane (getSyncHealth, getSyncLogs,
 *                  fetchRegionCards, getRegionSyncStatus, getActiveJobs, pauseRegionFetch,
 *                  resumeRegionFetch, stopRegionFetch, discoverTopRegions)
 *  - cards:        card maintenance and user stats (batchUpdateCardStats, refreshCardValues,
 *                  getMyImportHistory, getImportStats)
 */
import { mergeRouters } from "~/server/api/trpc";
import { nsImportVerificationRouter } from "./verification";
import { nsImportDecksRouter } from "./decks";
import { nsImportSyncRouter } from "./sync";
import { nsImportCardsRouter } from "./cards";

export const nsImportRouter = mergeRouters(
  nsImportVerificationRouter,
  nsImportDecksRouter,
  nsImportSyncRouter,
  nsImportCardsRouter
);
