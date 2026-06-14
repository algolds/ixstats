/**
 * Meetings router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.meetings.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - meetings:    cabinet meeting CRUD (create / list / get / update / delete)
 *  - attendance:  meeting attendance recording and retrieval
 *  - proceedings: in-meeting work — agenda items and decisions
 *  - actionItems: post-meeting action item CRUD
 *  - government:  government officials and departments (org-structure entities)
 */
import { mergeRouters } from "~/server/api/trpc";
import { meetingsMeetingsRouter } from "./meetings";
import { meetingsAttendanceRouter } from "./attendance";
import { meetingsProceedingsRouter } from "./proceedings";
import { meetingsActionItemsRouter } from "./actionItems";
import { meetingsGovernmentRouter } from "./government";

export const meetingsRouter = mergeRouters(
  meetingsMeetingsRouter,
  meetingsAttendanceRouter,
  meetingsProceedingsRouter,
  meetingsActionItemsRouter,
  meetingsGovernmentRouter
);
