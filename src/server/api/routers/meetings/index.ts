/**
 * Meetings router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.meetings.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - meetings:    cabinet meetings (create / list / get / accept / decline)
 *  - attendance:  meeting attendance recording and retrieval
 *  - proceedings: agenda items (add / list) and decisions (list)
 *  - government:  government officials (appoint / list / remove) and departments (list)
 */
import { mergeRouters } from "~/server/api/trpc";
import { meetingsMeetingsRouter } from "./meetings";
import { meetingsAttendanceRouter } from "./attendance";
import { meetingsProceedingsRouter } from "./proceedings";
import { meetingsGovernmentRouter } from "./government";

export const meetingsRouter = mergeRouters(
  meetingsMeetingsRouter,
  meetingsAttendanceRouter,
  meetingsProceedingsRouter,
  meetingsGovernmentRouter
);
