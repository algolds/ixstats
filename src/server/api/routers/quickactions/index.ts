/**
 * Quick Actions router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.quickActions.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - officials:  government officials listing
 *  - meetings:   cabinet meeting scheduling + listing
 */
import { mergeRouters } from "~/server/api/trpc";
import { quickActionsOfficialsRouter } from "./officials";
import { quickActionsMeetingsRouter } from "./meetings";

export const quickActionsRouter = mergeRouters(
  quickActionsOfficialsRouter,
  quickActionsMeetingsRouter
);
