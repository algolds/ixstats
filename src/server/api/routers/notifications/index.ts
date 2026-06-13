/**
 * Notifications router — split across files by domain (2026-06-13) and recombined here.
 *
 * mergeRouters preserves every procedure at the top level, so the public API path
 * `api.notifications.*` is byte-identical to the former monolith — no call sites change.
 * The `onNotificationAdded` subscription is preserved as-is (mergeRouters handles subscriptions).
 *
 * Domains:
 *  - user:        notification CRUD, read/dismiss toggles, unread count, stats, realtime subscription
 *  - preferences: user notification preferences + intelligence alert thresholds
 *  - events:      admin notification event config + admin notification browser
 *
 * `emitNotificationEvent` is re-exported here so external importers of
 * `~/server/api/routers/notifications` (e.g. src/lib/notification-api.ts) keep working
 * after the monolith file is replaced by this directory.
 */
import { mergeRouters } from "~/server/api/trpc";
import { notificationsUserRouter, emitNotificationEvent } from "./user";
import { notificationsPreferencesRouter } from "./preferences";
import { notificationsEventsRouter } from "./events";

export { emitNotificationEvent };

export const notificationsRouter = mergeRouters(
  notificationsUserRouter,
  notificationsPreferencesRouter,
  notificationsEventsRouter
);
