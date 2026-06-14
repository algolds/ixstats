/**
 * Diplomatic Scenarios router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.diplomaticScenarios.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - scenarios: scenario CRUD + read queries (public + admin)
 *  - choices:   choice/response-option CRUD, recording, and choice analytics
 *  - analytics: relevance scoring, usage tracking, performance + completion metrics
 *  - player:    player-facing scenario generation, country lookup, and history
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticScenariosScenariosRouter } from "./scenarios";
import { diplomaticScenariosChoicesRouter } from "./choices";
import { diplomaticScenariosAnalyticsRouter } from "./analytics";
import { diplomaticScenariosPlayerRouter } from "./player";

export const diplomaticScenariosRouter = mergeRouters(
  diplomaticScenariosScenariosRouter,
  diplomaticScenariosChoicesRouter,
  diplomaticScenariosAnalyticsRouter,
  diplomaticScenariosPlayerRouter
);
