import { EventEmitter } from "events";

/**
 * Single shared emitter for real-time notification SSE delivery.
 *
 * Previously each notifications router file (user/events/preferences) declared its
 * own `new EventEmitter()` plus its own `emitNotificationEvent`. Only user.ts's
 * emitter was actually subscribed to (its SSE `onNotifications` subscription), so
 * emits from the other two copies went nowhere. Living in the lib layer also lets
 * `notification-api` emit without importing from the api/router layer.
 */
export const notificationEmitter = new EventEmitter();
// Notifications fan out to one SSE listener per connected client; lift the default
// 10-listener cap so a busy server doesn't log MaxListenersExceededWarning.
notificationEmitter.setMaxListeners(0);

export function emitNotificationEvent(notification: unknown) {
  notificationEmitter.emit("notification", notification);
}
