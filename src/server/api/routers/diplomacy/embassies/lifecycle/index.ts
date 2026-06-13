/**
 * Diplomatic embassies / lifecycle router — split across files by concern (2026-06-13)
 * and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.diplomaticEmbassies.lifecycle.*` is byte-identical to the former monolith —
 * no call sites change, and diplomacy/embassies/index.ts still imports
 * `./lifecycle` (now resolved to this index.ts).
 *
 * Concerns:
 *  - status:    embassy close / reopen (active ↔ closed status toggling)
 *  - severance: permanent embassy deletion and diplomatic severance
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticEmbassiesLifecycleStatusRouter } from "./status";
import { diplomaticEmbassiesLifecycleSeveranceRouter } from "./severance";

export const diplomaticEmbassiesLifecycleRouter = mergeRouters(
  diplomaticEmbassiesLifecycleStatusRouter,
  diplomaticEmbassiesLifecycleSeveranceRouter
);
