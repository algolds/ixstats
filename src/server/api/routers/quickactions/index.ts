/**
 * Quick Actions router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.quickActions.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - officials:  government officials CRUD (get/create/update/delete)
 *  - meetings:   cabinet meetings + meeting decisions/action items lifecycle
 *  - policies:   policy CRUD + economic effect tracking + policy recommendations
 *  - activities: activity schedule (planner) + dashboard / meeting-outcome summaries
 */
import { mergeRouters } from "~/server/api/trpc";
import { quickActionsOfficialsRouter } from "./officials";
import { quickActionsMeetingsRouter } from "./meetings";
import { quickActionsPoliciesRouter } from "./policies";
import { quickActionsActivitiesRouter } from "./activities";

export const quickActionsRouter = mergeRouters(
  quickActionsOfficialsRouter,
  quickActionsMeetingsRouter,
  quickActionsPoliciesRouter,
  quickActionsActivitiesRouter
);
