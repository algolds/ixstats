/**
 * Cultural router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * (`api.diplomaticCultural.*` / wherever this router is mounted) is byte-identical to the
 * former monolith — no call sites change.
 *
 * Domains:
 *  - exchanges:     cultural exchange read/create/join and embassy-mission linking
 *  - lifecycle:     voting, artifact upload, update and cancellation of exchanges
 *  - npc:           NPC scenario generation and NPC participation responses
 *  - compatibility: exchange impact calculation, compatibility scores, recommended partners
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCulturalExchangesRouter } from "./exchanges";
import { diplomaticCulturalLifecycleRouter } from "./lifecycle";
import { diplomaticCulturalNpcRouter } from "./npc";
import { diplomaticCulturalCompatibilityRouter } from "./compatibility";

export const diplomaticCulturalRouter = mergeRouters(
  diplomaticCulturalExchangesRouter,
  diplomaticCulturalLifecycleRouter,
  diplomaticCulturalNpcRouter,
  diplomaticCulturalCompatibilityRouter
);
