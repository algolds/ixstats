/**
 * Diplomatic-embassies missions router — split across files by concern
 * (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API
 * exposed by `diplomaticEmbassiesMissionsRouter` is byte-identical to the
 * former monolith — no call sites change, and `embassies/index.ts` still
 * imports `./missions` (now resolved to this index.ts).
 *
 * Concerns:
 *  - lifecycle: completing a mission and browsing the next available missions
 *               (endpoints of a mission's life: see what's left, finish one)
 *  - execution: starting a mission and tracking active missions
 *               (the active phase: kick it off, then watch it run)
 *
 * The 208-vs-125 procedure-line split keeps both sub-files under the 700-line
 * ESLint ceiling; the natural query/mutation split would have placed both
 * `startMission` and `completeMission` (~293 lines combined) in a single file
 * (~784 lines), which is why the split groups procedures by lifecycle phase
 * rather than by HTTP method.
 */
import { mergeRouters } from "~/server/api/trpc";
import { diplomaticEmbassiesMissionsLifecycleRouter } from "./lifecycle";
import { diplomaticEmbassiesMissionsExecutionRouter } from "./execution";

export const diplomaticEmbassiesMissionsRouter = mergeRouters(
  diplomaticEmbassiesMissionsLifecycleRouter,
  diplomaticEmbassiesMissionsExecutionRouter
);
