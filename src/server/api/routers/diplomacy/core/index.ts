/**
 * Diplomatic Core router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.diplomaticCore.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - relations:  diplomatic-relation CRUD (get/create/update/delete + recent changes)
 *  - influence:  influence breakdown, strength updates, leaderboard, country follow graph
 *  - sharedData: embassy shared-data read/share/revoke across economic/intelligence/research/cultural/policy
 *  - options:    diplomatic-option dictionary and usage analytics
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticCoreRelationsRouter } from "./relations";
import { diplomaticCoreInfluenceRouter } from "./influence";
import { diplomaticCoreSharedDataRouter } from "./sharedData";
import { diplomaticCoreOptionsRouter } from "./options";

export const diplomaticCoreRouter = mergeRouters(
  diplomaticCoreRelationsRouter,
  diplomaticCoreInfluenceRouter,
  diplomaticCoreSharedDataRouter,
  diplomaticCoreOptionsRouter
);
