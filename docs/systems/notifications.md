# Notifications

**Last updated:** 2026-10-05
**Status:** Live. In-app notifications only: there is no email, push or Discord delivery. Per-user category and
minimum-urgency preferences are enforced for single-user notifications (2026-10-05, SL-5).
**Routes:** the Halo notification tray (every page except `/maps`), `/settings?tab=notifications`, `/admin/notifications`
**Code:** `src/server/api/routers/notifications/` (`user.ts`, `preferences.ts`, `events.ts`), `src/lib/notifications/`,
`src/components/halo/views/NotificationsView.tsx`, `src/stores/notificationStore.ts`, `src/hooks/useLiveNotifications.ts`

A notification is a `Notification` row addressed to one user, one country, or everyone. Server code creates rows
through `notificationAPI` or `notificationHooks`; the Halo tray lists them and the page title shows the unread
count. A separate client-only path shows toasts.

---

## 1. Data model

`prisma/schema/core.prisma`:

| Model | Purpose |
| :--- | :--- |
| `Notification` | One notification. `userId` set: for that user. `countryId` set: for that country's players. Both null: global. Also `title`, `message`, `description`, `href`, `type`, `category`, `priority` (default `medium`), `severity` (default `informational`), `source`, `actionable`, `deliveryMethod`, `metadata` (JSON string), `read`, `dismissed` |
| `NotificationEventConfig` | Admin on/off switch per event key (`eventKey`, `enabled`, `category`, `source`, `triggerType`). Rows are created by `seedEvents` |
| `UserPreferences` | Per-user preference row, keyed by Clerk id: `economicAlerts`, `crisisAlerts`, `diplomaticAlerts`, `systemAlerts`, `notificationLevel` (read when notifying; see §3), `emailNotifications`, `pushNotifications` (stored, no control and no delivery), plus the wiki preferences |
| `IntelligenceAlertThreshold` | Admin-set metric thresholds per country (`prisma/schema/intelligence.prisma`) |

### Who sees a notification

`visibleNotificationFilters` (`user.ts`) gives a user:

- rows where `userId` is the caller's Clerk id;
- global rows (`userId` and `countryId` both null);
- rows for the caller's country (`countryId` = `User.countryId`).

`getUnreadCount` and `markAllAsRead` use `visibleNotificationFiltersById`, which also matches the internal `User.id`.
The list query and single-row `markAsRead` / `dismissNotification` do not (see [Known gaps](#8-known-gaps)).

## 2. Categories and events

**Categories.** The router's `NotificationCategory` enum is: economic, diplomatic, governance, social, security, system,
achievement, crisis, opportunity, intelligence, policy, global, military. `notificationAPI` also accepts `cards`.
A few writers use other strings directly (`lib/sports/club-notify.ts` writes `category: "sports"`).

**Event registry.** `NOTIFICATION_EVENTS` (`src/lib/notifications/events-registry.ts`) lists 13 admin-switchable
events:

| Category | Event keys |
| :--- | :--- |
| economic | `budgetYearNotification`, `onTaxSystemChange` |
| diplomatic | `onDiplomaticEvent` |
| governance | `onGovernmentStructureChange`, `onQuickActionComplete`, `onMeetingEvent`, `onVitalityScoreChange` |
| achievement | `onAchievementUnlock` |
| social | `onThinkPageActivity`, `onSocialActivity`, `onThinktankActivity` |
| system | `onUserAccountChange`, `systemNotification` |

**The guard.** `isNotificationEventEnabled(eventKey)` (`guard.ts`) reads `NotificationEventConfig` through a 30-second
cache. An event with no config row is enabled. Two places check it:

- each hook in `hooks.ts` checks its own key (`onTaxSystemChange`, …);
- `notificationAPI.create` checks `` `${source}Notification` `` when `source` is set. For example `source: "budgetYear"` →
  `budgetYearNotification`. Sources with no registry entry are always enabled.

A suppressed `create` throws; callers wrap it in try/catch.

## 3. Recipient preferences

Settings → Notifications (`NotificationSettingsPanel`) saves four category switches and a minimum urgency to
`UserPreferences`. `recipientAccepts()` (`src/lib/notifications/recipient-preferences.ts`) applies them inside
`notificationAPI.create` and `createMany`, after the event guard:

| Switch | Field | Categories it governs |
| :--- | :--- | :--- |
| Economic events | `economicAlerts` | `economic`, `cards` |
| Crisis and security | `crisisAlerts` | `crisis`, `security`, `military` |
| Diplomacy | `diplomaticAlerts` | `diplomatic` |
| Platform notices | `systemAlerts` | `system` |

Other categories (governance, social, achievement, …) have no switch and always pass.

**Priority threshold** (`notificationLevel`): `low` and `all` let everything through, `medium` drops `low`-priority
notifications, `high` drops `low` and `medium`. A notification with no priority counts as `medium`.

- Only notifications with a `userId` are filtered. Country-wide and global notifications always show.
- The recipient may be addressed by Clerk id or internal `User.id`; both resolve to the Clerk-keyed preference row.
- A user who never saved preferences gets the panel's defaults (everything on, `low`).
- A filtered `create` returns `""` and writes nothing (unlike the event guard, it does not throw). `createMany` drops
  the filtered rows and writes the rest.
- Preference reads fail open: a database error delivers the notification.
- Writers that bypass `notificationAPI` (`lib/sports/club-notify.ts`, the messaging module's admin broadcast (`sendAdminBroadcast`),
  admin `createNotification`) are not filtered.

## 4. Delivery paths

| Path | What it does | Persisted |
| :--- | :--- | :--- |
| `notificationAPI` (`api.ts`) | `create`, `createMany`, `trigger` and helpers (`notifyCountry`, `notifyGlobal`, `notifyEconomicChange`, `notifyQuickActionResult`, `notifyAdminAction`, …). About 30 server files call `notificationAPI.create` | `Notification` row |
| `notificationHooks` (`hooks.ts`) | Domain hooks (`onDiplomaticEvent`, `onAchievementUnlock`, `onThinktankActivity`, …) that check the guard and then create rows | `Notification` row |
| Direct `notification.create` | `lib/sports/club-notify.ts` (club match results, when the sports `clubDms` setting is on), `server/modules/messaging/conversation-operations.ts` (`sendAdminBroadcast`) and the admin `notifications.createNotification`. Not filtered by recipient preferences | `Notification` row |
| `notifyFromStore` (`notify-store.ts`, `useNotify`) | Client toast (sonner `ToastBanner` with a Cuelume sound). `priority: "low"` and `silent` skip the toast. With `persistent: true` it also adds an entry to the in-memory `useNotificationStore` | Browser memory only |

Server writers include achievements, auctions and card market, budget year rollover, elections, diplomacy (embassies,
alliances, policies, influence), follows, forum, government, legislation, meetings, national issues, polls,
quick actions, security, tax system, ThinkPages posts, ThinkTanks, trading offers, country linking, Vault admin and
daily claims, messaging, and the intelligence alert thresholds (`server/shared/intelligence-alert-thresholds.ts`,
called from `countries.update`).

`notifyAdminAction` sets `deliveryMethod` (`modal`, `dynamic-island` or `toast`), but the tray does not read
`deliveryMethod`; every row is shown the same way.

## 5. The Halo tray

`NotificationsView` (`src/components/halo/views/NotificationsView.tsx`) opens from the Halo bell or `Ctrl`/`Cmd` + `N`.

- **Two tabs:** Notifications and Messages. Messages lists the 8 newest inbox conversations
  (`messages.getConversationsByFolder`).
- **Notifications** merges three sources:
  1. server rows: `notifications.getUserNotifications({ limit: 8 })`, cached for 5 minutes and not refetched on focus;
  2. "enhanced" entries from `useNotificationStore` (browser memory; added by `notifyFromStore({ persistent: true })`);
  3. "executive" entries from `ExecutiveNotificationContext` (nothing sets these today).
- Entries are grouped into Recent (< 1 h), Earlier today, This week and Earlier.
- Clicking an entry marks it read and opens its `href`. Dismiss calls `dismissNotification`, which sets
  `dismissed` and `read`. **Read all** marks notifications and messages read.
- Mutations invalidate `getUserNotifications` and `getUnreadCount`.

**Badge.** `useNotificationBadge` (`src/hooks/useLiveNotifications.ts`, mounted in `GameProviders`) polls
`getUnreadCount` every 30 seconds and on window focus. It prefixes the page title with `(N) `.
`title-badge.ts` keeps the prefix right when several instances are mounted.

## 6. Procedures

`api.notifications.*` (the three files are merged with `mergeRouters`):

| Procedure | Auth | Notes |
| :--- | :--- | :--- |
| `getUserNotifications` | public | Empty result when signed out. Filters `dismissed: false`; optional `unreadOnly`, `type` |
| `getUnreadCount` | public | 0 when signed out. Identity from `ctx` only |
| `markAsRead`, `dismissNotification`, `markAllAsRead` | protected, light rate limit | Always act on the caller. An optional `userId` input is still accepted for old clients and ignored. A row the caller can't see is `NOT_FOUND` |
| `getPreferences`, `upsertPreferences` | protected / protected light rate limit | Caller may only read or write their own row (`input.userId` must equal `ctx.auth.userId`) |
| `createNotification`, `deleteNotification`, `deleteAllNotifications` | admin | Admin composer and browser |
| `getAllEvents`, `seedEvents`, `toggleEvent`, `batchToggleEvents` | admin | Event registry panel |
| `getAllAdminNotifications` | admin | Admin browser with filters |
| `getAlertThresholds`, `updateAlertThreshold`, `deleteAlertThreshold` | admin | Alert rules panel |

The admin console page `/admin/notifications` has the composer, browser, events registry, alert rules and a test
suite panel (`src/app/admin/notifications/_components/`).

## 7. Jobs

There is no notification job. Notifications are written by the code paths above, including cron jobs such as
`budget-year-rollover`, `elections` and the sports season cron.

## 8. Known gaps

- **No email or push delivery** exists; the Settings toggles for them are hidden. `emailNotifications` and
  `pushNotifications` are still stored.
- **Preferences cover single-user notifications only**, and only those written through `notificationAPI` (see §3).
- **List and badge disagree for rows keyed by internal user id.** `getUserNotifications` and single-row
  `markAsRead`/`dismissNotification` match `userId` against the Clerk id only, while `getUnreadCount` and
  `markAllAsRead` also match `User.id`. Sports club results (`club-notify.ts`) are written with
  `SportTeam.ownerUserId` (an internal id), so they raise the badge but never appear in the tray list.
- The tray loads 8 rows; there is no full notification history page.
- `deliveryMethod` and `severity` are stored but the tray ignores them.
- "Executive" notifications have no producer, and "enhanced" (client) entries are lost on reload.
- `NotificationEventConfig.lastTriggered` and `triggerCount` are never updated.

## Related documentation

- [Halo](./halo.md): the tray's host
- [Settings](./settings.md): the Notifications panel
- [Admin CMS](./admin-cms.md)
