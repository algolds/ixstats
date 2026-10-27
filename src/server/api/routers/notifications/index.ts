/**
 * Notifications router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.notifications.*` is byte-identical to the former monolith — no call sites change.
 *
 * Domains:
 *  - user:        notification CRUD, read/dismiss toggles, unread count
 *  - preferences: user notification preferences + intelligence alert thresholds
 *  - events:      admin notification event config + admin notification browser
 */
import { mergeRouters } from "~/server/api/trpc";
import { notificationsUserRouter } from "./user";
import { notificationsPreferencesRouter } from "./preferences";
import { notificationsEventsRouter } from "./events";

export const notificationsRouter = mergeRouters(
  notificationsUserRouter,
  notificationsPreferencesRouter,
  notificationsEventsRouter
);
