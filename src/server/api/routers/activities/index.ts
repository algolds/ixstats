/**
 * Activities router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.activities.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - feed:       global / following / user / country activity feeds and headlines
 *  - activities: activity CRUD, engagement, comments, stats, test mutation
 *  - trending:   trending topics and unified trending aggregation
 *  - follows:    country follow graph (follow/unfollow, followers/following, stats)
 */
import { mergeRouters } from "~/server/api/trpc";
import { activitiesFeedRouter } from "./feed";
import { activitiesActivitiesRouter } from "./activities";
import { activitiesTrendingRouter } from "./trending";
import { activitiesFollowsRouter } from "./follows";

export const activitiesRouter = mergeRouters(
  activitiesFeedRouter,
  activitiesActivitiesRouter,
  activitiesTrendingRouter,
  activitiesFollowsRouter,
);
