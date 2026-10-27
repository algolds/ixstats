/**
 * Meetings router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.meetings.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - meetings:    cabinet meetings (create / list)
 *  - attendance:  meeting attendance recording
 *  - proceedings: agenda items (add) and concluding a meeting with its decisions
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
