# WikiOS Editing Toggle

**Date:** 2026-10-08
**Status:** Approved design, awaiting spec review

## Goal

Let an admin unlock editing in WikiOS from `/admin/wikios-settings`, without the full v1 cutover. While the toggle is on, both wikis stay editable and in sync: every WikiOS edit is mirrored to classic MediaWiki, and MediaWiki stays the wiki of record for inbound edits.

## Today

`WIKIOS_V1_ENABLED` (`src/lib/wiki-os/v1-switch.ts`, env, off by default) gates everything at once. Off means:

- WikiOS refuses every write with MediaWiki's `readonly` error. This covers page edits, moves, deletions, protections, blocks, rights changes, uploads, XML imports and bot passwords, plus every `/w/api.php` request.
- The outbound mirror and the background renders do nothing.
- Inbound sync is MediaWiki-first.
- Lore cards and lorewards read MediaWiki.
- Native search uses the legacy query.

## Decisions (owner, 2026-10-08)

| Question | Decision |
| --- | --- |
| What the toggle turns on | Editing plus mirror. Inbound sync, lore cards, lorewards, search and background renders keep today's behaviour. |
| Who can edit when on | Everyone with wiki rights. The normal rules apply: blocks, protection, namespaces, user rights. |
| Env var | `WIKIOS_V1_ENABLED` stays the full cutover and overrides the toggle. Env on means everything on, and the toggle is shown as forced on. |
| Guardrails | The mirror keeps draining after the toggle goes off. The toggle refuses to switch on unless the mirror is configured. Every flip writes an audit log row and sends a Discord DM. The UI asks for confirmation. |
| DM channel | IxBot: the `DISCORD_BOT_TOKEN` that `/usr/local/bin/ixwiki-notify.sh` uses, DMing the same admin user. |

## Design

### Setting and switch

- `SystemConfig` row `wikios_editing_enabled`, value `"true"` or `"false"`. A missing row means off.
- `isWikiosEditingEnabled()` also starts a background refresh when its cache is stale, so read paths, such as the Edit / View source decision, pick up a flip without an explicit await.
- New `src/lib/wiki-os/editing-switch.ts`:
  - `isWikiosEditingEnabled(): boolean`, synchronous. It returns `isWikiosV1Enabled() || cachedFlag`. Before the first load, `cachedFlag` is `false`.
  - `refreshWikiosEditingFlag(): Promise<boolean>` reads the row, at most once per 15 s per process. Concurrent callers share one in-flight read. A read error keeps the last known value and logs a warning.
  - `setWikiosEditingFlag(db, on)` upserts the row and updates the local cache immediately.
- Write entry points `await refreshWikiosEditingFlag()` before the synchronous permission checks run:
  - the WikiOS tRPC write procedures (through the existing wikios middleware or the permission helpers' async callers);
  - `/w/api.php`;
  - `/api/wiki/upload`;
  - `/api/wiki/import`;
  - the mirror cron.
  A flip therefore reaches every process within about 15 s: the app, the cron runner and standalone WikiOS.

### Which parts follow which switch

| Call site | Switch |
| --- | --- |
| `permissions.ts` `decideAction`, `decideFilePageCreation` | editing |
| `app/w/api.php/route.ts`, `api/wiki/upload`, `api/wiki/import` | editing |
| `services/render-service.ts` (stale renders) | full v1 only (unchanged): without the cutover there is no private render engine, so the background queue would send every stale page to public MediaWiki. Edited pages still render when a reader opens them. |
| `services/mirror-worker.ts` | editing, or outbox not empty (drain) |
| `services/inbound-revision-sync.ts` | full v1 only (unchanged) |
| `cards/lore-card-generator.ts`, `lorewards/sync.ts` | full v1 only (unchanged) |
| `core/native-search-service.ts` | full v1 only (unchanged) |

The readonly reason text changes to: "WikiOS editing is turned off. Classic MediaWiki is still the wiki you edit." The UI already decides between Edit and View source from the permission decision, so it follows the toggle with no change.

### Mirror drain

The mirror worker skips only when editing is off and no `pending` or `running` outbox jobs remain. After a switch-off, edits made while the toggle was on still reach MediaWiki.

### Accepted risk

Inbound sync stays MediaWiki-first. Suppose a WikiOS edit has not been mirrored yet when a MediaWiki edit of the same page arrives. The MediaWiki revision becomes the WikiOS head, and the WikiOS edit's mirror job meets an edit conflict and goes `dead`. It is then visible in the existing Mirror Outbox panel, and the existing dead-job alert fires. Full cutover (`WIKIOS_V1_ENABLED`) is what removes this risk.

### Preconditions for switching on

`setEditing({ enabled: true })` refuses with PRECONDITION_FAILED unless the mirror can write:

- `wikiosConfig.mediawiki.botUser` is set;
- the bot token is set;
- `writeApiUrl` is set.

The message names what is missing. Switching off is always allowed.

### API

The `wikios` router (it already serves `getMirrorStatus` to `/admin/wikios-settings`) gains two procedures, both `adminProcedure`:

- `getEditingStatus()` → `{ enabled, forcedByEnv, mirrorConfigured, missing: string[] }`.
- `setEditing({ enabled })`:
  - checks the precondition;
  - upserts the row;
  - writes an `AdminAuditLog` row (action `wikios.editing.enable` or `wikios.editing.disable`, actor, previous and new value);
  - then sends the DM in the background. A DM failure is logged and never fails the call.
  - It is a no-op, with no audit row and no DM, when the value doesn't change.

### Discord DM (IxBot)

New `src/lib/discord/admin-dm.ts`, `sendAdminDm(message): Promise<void>`:

- `POST https://discord.com/api/v10/users/@me/channels` with `{ recipient_id }` and header `Authorization: Bot $DISCORD_BOT_TOKEN`, then `POST /channels/{id}/messages` with `{ content }`.
- The recipient is `DISCORD_ADMIN_USER_ID`, defaulting to `156198941879304192`, the admin in `ixwiki-notify.sh`.
- No token: a no-op. Requests time out after 10 s.
- The message reads "WikiOS editing turned on by <name>" or "…off…", plus the mirror outbox count when switching off.

### Admin UI

In `WikiOSSettingsPanel`, add an "Editing" section above the Mirror Outbox section:

- A `Switch` with a one-line state description.
- When `forcedByEnv` is true, the switch is disabled and on, and the text reads "Forced on by WIKIOS_V1_ENABLED".
- When the mirror is not configured, switching on is disabled and the missing settings are listed.
- Flipping opens a confirmation `Dialog`:
  - Turning on: "Anyone with wiki rights can edit in WikiOS. Every edit is copied to classic MediaWiki."
  - Turning off: "New WikiOS edits are refused. Edits already made keep copying to MediaWiki."
- The section uses Facet primitives from `src/components/ui/` and `iconoir-react` icons, with no uppercase labels or em dashes.

## Testing

- `editing-switch`:
  - defaults to off;
  - the env forces it on;
  - the row turns it on and off;
  - the 15 s cache serves stale until expiry, then refreshes;
  - a read error keeps the last value;
  - concurrent refreshes share one query.
- `permissions`: `decideAction` allows an edit when editing is on and env is off, and refuses with `readonly` when both are off.
- Mirror worker:
  - runs when editing is on;
  - drains when off with pending jobs;
  - skips when off and the outbox is empty.
- Router:
  - non-admin is refused;
  - switching on with the mirror unconfigured gives PRECONDITION_FAILED;
  - a successful flip writes the audit row and calls `sendAdminDm`;
  - an unchanged value is a no-op;
  - a DM failure still resolves.
- `sendAdminDm`: no token means no fetch; it makes two calls in order; it swallows errors.
- Browser, signed-in on the `ixstats_wv1` clone (the e2e user is given an admin role on the clone only for this check, then restored):
  - flip the toggle as an admin; the confirmation shows and the state persists;
  - as the e2e user, an article's Edit opens the editor when on and View source when off.

## Out of scope

- A staged rollout (admins first).
- Changing inbound sync, lore cards or search.
- Full cutover steps.
