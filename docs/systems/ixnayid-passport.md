# IxnayID Passport

**Last updated:** 2026-10-23

**Routes:** `/@user`, `/id/[username]`, `/r/[realm]/@user` (rewrites to `/r/[realm]/u/[username]`) | **Module:** `src/server/modules/identity/` | **Router:** `api.ixnayid` (`src/server/api/routers/ixnayid/`) | **UI:** `src/components/passport/`

The passport is the public face of an IxnayID account. It is readable signed-out; the viewer's id only decides ownership (the Edit Passport control and the settings on the back face).

---

## Tabs

| Tab      | Procedure               | Contents                                                                       |
| -------- | ----------------------- | ------------------------------------------------------------------------------ |
| Overview | `getPassport`           | Featured realm, the **showcase** (below), platform affiliations, civic stature |
| Realms   | `getRealms`             | Every realm membership and claimed country                                     |
| Work     | `getWork`               | WikiOS pages and activity, Onoma languages, MyLeague clubs, directives         |
| Vault    | `getPassport` (`vault`) | Collector level, deck value, the top cards (the holder's display)              |
| History  | `getHistory`            | Cross-platform activity stream, paged                                          |

The front face also carries a stat row (Lorewards, Focus, Forum, IxCredits) and the owner's signature inscription.
The **Lorewards** stat (`wiki.lorewards`, `PassportStatRow`) shows the holder's rank and score added up over their shown
approved claimed names (`lorewardStatsOfNames`, `src/lib/lorewards/stats-of-names.ts`: both spellings of each name; the
streaks are the largest, not a sum; the rank places the summed score among the per-name rows). On their own passport the
owner's hidden names count too. Selecting it opens the Lorewards sheet (`PassportLorewardsModal`), which renders the
shared `LorewardsView` (`focus="you"`, see [Achievements → Lorewards](./achievements.md#lorewards)) for one name, with a
name picker when there are several; its trophy cards follow the holder's Vault cards visibility. There is no Lorewards
panel on the Overview tab.
The photo wears the holder's equipped Vault glow and frame and the name carries their badge, for every visitor
(`PassportPortrait`, `vault.getEquippedCosmeticsFor`; equipping is the opt-in, there is no separate toggle).

---

## Showcase

Shown on the Overview tab (`components/passport/showcase/PassportShowcase.tsx`). Real data only; each panel has an empty state, and a "kept private" state when the owner hides it.

- **Achievements & ribbons** (`showcase.achievements`): unlocked count out of the active catalogue, total points, the **signature shelf** (the owner's pinned ribbons, or their three rarest when none are pinned), the full **ribbon rack**, and the next few achievements by rarity. Loaded by `loadAchievementsShowcase` (`identity.showcase.ts`) from `UserAchievement` rows keyed by the owner's Clerk id. How ribbons are derived and styled: [Achievements → Ribbons](./achievements.md#ribbons).
- **Top cards** (`vault.topCards`, on the Collection tab): the holder's display (`displayedCopies`, `src/lib/cards/hub/displayed.ts`): their pinned public showcase, else their six most valuable live copies, one per card. Each is a card face in full colour to every visitor, whatever they hold, since the display shows off the holder's collection ([cards.md](./cards.md#uncollected-cards)), and it opens the card sheet through the holder (`from=holder.<handle>`); a signed-out visitor opens these sheets too, while the holder shows Vault cards, since `cards.getSheet` answers signed out for cards shown in public.

`vault.focus` counts distinct lore categories across the whole live collection (NationStates imports excluded) out of the 12 lore categories, and names the largest.

---

## Privacy settings

The owner flips the passport (Edit Passport) to change settings. Every change is saved to the owner's `PassportPreference` row (`prisma/schema/identity.prisma`, one row per `User.id`; no row means the defaults). All sections default to shown.

| Toggle (UI key)                    | Column             | What the server strips when off                                                                                                             |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Achievements (`achievements`)      | `showAchievements` | `showcase.achievements`; `getRibbons` and `getCountryRibbons` return nothing, so the country-page rack disappears too                       |
| Civic Accolades (`accolades`)      | `showLorewards`    | `wiki.lorewards` and Lorewards laurels in the Work and History feeds (`wiki.awardHistory` is gone; the modal reads `lorewards.getTrophies`) |
| Focus (`impact`)                   | `showFocus`        | `vault.focus`                                                                                                                               |
| Forum Discussions (`forumStats`)   | `showForumStats`   | `forum.stats` (title, messages, reactions, trophy points)                                                                                   |
| IxCredits (`vaultCards`)           | `showVault`        | the whole `vault` (credits balance and collection)                                                                                          |
| Activity History (`historyStream`) | `showHistory`      | `getHistory` returns an empty page                                                                                                          |

Enforcement is server-side: `getPassport` skips loading hidden sections and passes the rest through `redactPassportSections` (`identity.privacy.ts`), so hidden data never reaches the response. Hidden sections are hidden from **every** viewer, the owner included, so the owner sees what visitors see. The payload's `privacy` object says which sections are shown, so the UI can explain an absent section.

The back face also saves:

- **Signature inscription** (`signature`, up to 60 characters; blank falls back to the display name), saved on Done.
- **Signature ribbons** (`pinnedRibbonKeys`, up to 3). The server keeps only keys of achievements the owner has unlocked.

### Procedures

| Procedure                        | Kind                                  | Purpose                                                     |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `ixnayid.getPassport`            | public query                          | Passport payload with hidden sections removed               |
| `ixnayid.getRibbons`             | public query                          | Every ribbon of a passport holder                           |
| `ixnayid.getCountryRibbons`      | public query                          | A country owner's top 3 ribbons and total                   |
| `ixnayid.getPassportSettings`    | protected query                       | The signed-in user's settings and every ribbon they can pin |
| `ixnayid.updatePassportSettings` | protected mutation (light rate limit) | Save visibility, signature and pins                         |

---

## Wiki identity

The passport account is the only IxWiki and WikiOS identity ([design](../superpowers/specs/2026-10-23-ixnayid-identity-and-lorewards-design.md), plan A). An old IxWiki (classic MediaWiki) user name reaches an account only through a **name claim** an administrator approved. The old IxWiki link is gone: the user-page token for IxWiki, IxWiki `WikiAccountLink` rows, `User.wikiUsername`, `wikiUserId` and `lastWikiSync`, the `showWikiAttribution` privacy switch, the static MediaWiki reconciliation matrix and `wiki-mappings.ts`. IIWiki and AltHistory linking stays, as [sister wikis](#sister-wikis).

### Name claims

**Data:** `wiki_name_claims` (`WikiNameClaim`, `prisma/schema/wiki.prisma`): account, source (`ixwiki`), name, status (`PENDING`, `APPROVED`, `REJECTED`, `REVOKED`), `visible`, `rightsPass`, origin (`PLAYER`, `ADMIN_LINK`, `CONVERSION`), the player's evidence, the decision note, who asked and who decided, and the MediaWiki user id when an admin link knew it. An account may hold several names (alts, renames). A name has at most one approved owner, and an account at most one open request per name: two partial unique indexes (`wiki_name_claims_one_approved_key`, `wiki_name_claims_one_pending_key`) that live only in the claims SQL (`prisma/migrations/20261103120000_ixnayid_claims/`), since a Prisma schema cannot express them.

**Names** are stored in MediaWiki's form (`claimName`: underscores read as spaces, the first letter upper-cased), up to 85 characters, with none of `# < > [ ] | { }` (so a `wikios>` import label can never be claimed).

**The service** is `createNameClaimService` (`src/server/modules/identity/identity.name-claims.ts`). Every write runs in one transaction under the name's advisory lock (41103, `lockWikiNameTx` in `src/lib/identity/claim-tags.ts`, taken alone; no card or vault lock) and writes an `AdminAuditLog` row (`WIKI_NAME_CLAIM_REQUESTED`, `_VISIBILITY`, `_APPROVED`, `_REJECTED`, `_REVOKED`, `WIKI_NAME_LINKED`). Refusals carry a code (`NameClaimError`) that `toNameClaimTrpcError` turns into a tRPC error with the message kept.

| Step            | Who, where                                                                                   | Procedure                                                                                                                                               | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ask             | The player, in Settings, IxnayID & passport, **Old IxWiki names** (`WikiNameClaims`)         | `ixnayid.requestNameClaim({ name, evidence? })`                                                                                                         | A `PENDING` claim (origin `PLAYER`). Refused when the player already holds or asked for the name, when another account holds it ("That name already belongs to another account."), or with 10 requests already waiting. Several players may ask for one name; the first approval wins.                                                                                                                                                      |
| See             | The player                                                                                   | `ixnayid.listMyNameClaims`                                                                                                                              | Every claim and status ("Waiting for review", "Approved", "Not approved", "Removed") with the decision note. No notification is sent on a decision.                                                                                                                                                                                                                                                                                         |
| Approve, reject | An administrator, in Admin, Users, **Name claims** (`src/app/admin/users/NameClaimsTab.tsx`) | `admin.listNameClaims({ status, cursor?, limit })`, `admin.approveNameClaim`, `admin.rejectNameClaim` (`{ claimId, note? }`)                            | The queue by status shows the account (handle, country), the name's evidence (WikiOS edits under either spelling, Lorewards standing, unexpired imported groups, a block in force, who else holds or asks) and the player's own words.                                                                                                                                                                                                      |
| Link directly   | An administrator, from the tab's **Link an old name** sheet (`LinkLegacyNameSheet.tsx`)      | `admin.searchLegacyWikiNames({ query, limit })`, `admin.findNameLinkTargets({ query })`, `admin.linkLegacyWikiName({ userId, name, note?, mwUserId? })` | For legacy players who never linked. The name search covers WikiOS revision authors, Lorewards names (stats, winners, runners-up) and classic MediaWiki's user list (`list=allusers`, read-only, `fetchClassicWikiUsers`); the account search takes a handle, country or Clerk id. The link approves the account's own pending claim on the name, returns a name it already holds unchanged, or creates and approves an `ADMIN_LINK` claim. |
| Remove          | An administrator, on an approved claim                                                       | `admin.revokeNameClaim({ claimId, note? })`                                                                                                             | `REVOKED`: every revision tag the claim made is taken back (`authorId` returns to null), payouts already made stay paid (design decision 7). After the commit the revoke hook takes the name's trophy cards back for its next approved owner ([Claim hooks](#claim-hooks)). The name is free again.                                                                                                                                         |
| Show or hide    | The player, the switch on each pending or approved name                                      | `ixnayid.setNameClaimVisibility({ claimId, visible })`                                                                                                  | See [Visibility](#visibility).                                                                                                                                                                                                                                                                                                                                                                                                              |

The `ixnayid.*` claim procedures are signed-in rate-limited mutations (`listMyNameClaims` a protected query); the `admin.*` ones are `adminProcedure` (`src/server/api/routers/admin/name-claims.ts`, thin: the service decides, `identity.name-search.ts` reads).

**An approval** (approve or link), under the name's lock: refuses when another account holds the name, or when another account's passport handle spells it as MediaWiki normalises it ("That name is another player's passport handle."; `setHandle` refuses the other way round, a handle that spells another account's approved name). It then sets `APPROVED`, the decider, the note and `rightsPass`, tags the name's revisions (below) and writes the audit row, all in the one transaction. The claim-approval hooks run after the commit ([Claim hooks](#claim-hooks)).

**The system-owner rule** (plan 409, kept): imported MediaWiki groups (`wiki_user_groups` rows keyed by `wikiUsername`, from `scripts/wikios-import-rights.ts`) pass to the account only through a claim with `rightsPass`, which is set when a **system owner** approved or linked it (or the conversion found a link the account proved with its own token or a system owner confirmed). Imported blocks (`wiki_blocks.wikiUsername`) follow every approved claim. An administrator who is not a system owner cannot approve or link a name for their own account ("You cannot approve a name for your own account: ask another administrator."), and the tab warns them, on a name with imported groups, that the groups stay behind. A player never acts as a system owner.

### Visibility

Each claim has `visible`. A claim its owner hides shows nowhere anyone else looks: no profile card or `users.resolveWikiAuthor` answer, no `User:` redirect (the page renders as an unclaimed name's would), no wiki name on the passport, no mirror name (the edit goes out as `wikios>handle`), no public trophies holder. It still counts for rights, blocks, revision tags, Lorewards payouts, achievements, Ixnay realm auto-approval, bot-password login aliases and the owner's own views. The conversion keeps the claims of players who had `showWikiAttribution` off hidden; Settings tells them "Private until you confirm" until they turn each name on.

### Revision tags

`wiki_revision_claim_tags` (`WikiRevisionClaimTag`) logs every `authorId` a claim put on a revision, so a revoke undoes exactly those. `tagClaimRevisionsTx` puts the account on the name's IxWiki revisions (either spelling) that have no author yet; a revision that already has one (a native WikiOS edit, a system save) is never touched. `untagClaimRevisionsTx` sets `undoneAt` and clears the author only where the claim's account is still on it. The inbound MediaWiki sync and the XML importer store a revision with no author and then tag it for its editor's approved claim after the commit (best effort: one left untagged keeps no author, never a wrong one). Contributions, the autoconfirmed rule (4 days and 10 edits), achievements and the Vault dividend count tagged revisions. The past revisions of claims made before the deploy are tagged once by `scripts/identity/tag-claimed-revisions.ts` (runbook step 3).

### The resolver

`src/lib/identity/wiki-names.ts` is the one answer to "who is this wiki name". Only an approved claim identifies anyone; a pending, rejected or revoked claim answers nothing. Anything a person other than the owner sees reads with `{ shown: true }`, so a hidden claim answers nothing there; rights, blocks, tags, payouts and the owner's own views read without it.

| Function                       | Answer                                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ownerOfName`, `ownersOfNames` | The account holding a name's approved claim                                                                                                                                                                                                                                      |
| `namesOfUser`, `namesOfUsers`  | Every name an account holds, oldest approval first                                                                                                                                                                                                                               |
| `primaryNameOf`                | The account's first-approved name (with `shown`, its first shown one)                                                                                                                                                                                                            |
| `accountOfWikiName`            | The account a `User:` title stands for: its approved claim; with `shown`, a hidden claim answers null and never falls through to a handle; with no approved claim, the account whose handle the name spells (handles are lower-case, so a name with other capitals matches none) |

Its readers include `users.resolveWikiAuthor` and `users.wikiUserPageOwner`, `ixnayid.getStatus` and the passport, WikiOS rights, user info, contributions, watchlist notices and the mirror, the inbound sync, Lorewards and achievements, Ixnay realm claims, the Vault dividend's wiki part and bot-password logins.

### Claim hooks

`src/lib/identity/claim-hooks.ts`: `CLAIM_APPROVED_HOOKS` run, in order, after an approval or admin link commits, and
`CLAIM_REVOKED_HOOKS` after a revoke commits, outside every transaction and lock, with a `ClaimApprovedEvent` (claim,
account, name, time, origin) or a `ClaimRevokedEvent` (claim, the account that held the name, name, time). A hook must
be idempotent (an approval may be retried after a crash between the commit and the hooks); one that throws is logged
(`[identity] claim hook failed`, `[identity] claim revoke hook failed`) and the decision stands. The conversion and the
tag backfill run no hooks: the daily Lorewards full sync pays converted claims. Each list holds one Lorewards hook
(`src/lib/lorewards/claim-hook.ts`, loaded on demand): an approval settles the contests that record the name (places from
15 October 2026 pay once, and every place's trophy card back to 2017 is minted and given); a revoke takes the name's
trophy cards back from the former owner, voided, for the name's next approved owner, and the IxC paid stays paid
([cards.md](./cards.md#loreward-trophy-cards)). Achievements the name unlocked, and their IxC, also stay with the former
owner (owner decision, 2026-10-23): a wrong approval is fixed by hand.

### Handles as edit authors

The passport handle (`User.handle`) signs every WikiOS edit (design decision 9). `requireWikiAuthorName` (`src/lib/wiki-os/auth.ts`) refuses a save, revert, rollback or upload by an account with no handle (`PRECONDITION_FAILED`, "Pick a passport handle before you save."; `/w/api.php` answers `permissiondenied`), so an edit is never stored under a country name or a Clerk id. Log actor labels read the handle, else "anonymous".

**The first-save handle picker:** before a handle-less player's first save goes out, `useHandleGate` (`src/hooks/useHandleGate.ts`, in `WikiEditBridge`) opens `HandlePickerDialog` ("Pick your passport handle"), prefilled by `ixnayid.suggestHandle` (the first shown claimed name, else the old forum name, else the nation's name, never a hidden claim's name, made free if taken). `ixnayid.setHandle` saves it (3 to 24 lowercase letters, numbers or underscores; the first pick is free and one self-service change follows), clears the request-context cache for that user in this process (`forgetContextUser`), and the save goes on. If the status cannot be read, the save goes on and the server decides.

**The mirror name:** `services/mirror-revision.ts` imports each WikiOS revision into classic MediaWiki under its author's first shown claimed name, which MediaWiki credits to that account (`assignknownusers=1`), else as `wikios>handle`.

### User pages

A root `User:<name>` page whose name is a handle or a shown claimed name redirects (307, since a claim can be revoked) to the owner's passport, `/@handle` (`userView` in `src/app/(wiki-os)/wiki/[...slug]/_views/read-views.tsx`, through `users.wikiUserPageOwner`); `?redirect=no` still redirects, and subpages are not redirected. The old page's text stays in its history and in classic MediaWiki. A hidden claim's page renders as an unclaimed name's (its text and profile card, or a 404 when nobody by that name exists). A player may edit their own user space: their handle's and their approved claimed names' `User:` pages and subpages (not `.js`, `.css`, `.json` or `.less`; `checkEditPolicy`, `src/lib/wiki-os/namespace-policy.ts`).

### Bot passwords

A bot password belongs to the account (design decision 11; `src/lib/wiki-os/api-compat/auth-store.ts`, `wikios.listBotPasswords` / `createBotPassword` / `deleteBotPassword`). An account needs a passport handle to create one ("Pick a passport handle in Settings before creating a bot password.") and logs in as `handle@App`. Every approved claimed name, hidden or shown, works in place of the handle, so bots set up under an old wiki name keep running; `Special:BotPasswords` lists them ("Your old wiki names work too: ..."). A login name is matched to the account whose handle it is, as typed, first, then through `accountOfWikiName`. `list=allusers` on `/w/api.php` lists handles.

### Sister wikis

Settings, IxnayID & passport, Linked accounts, **Sister wikis** keeps IIWiki and AltHistory linking (`WikiAccountVerifyRow`, `src/server/modules/identity/identity.wiki-links.ts`): the player puts a one-time token (valid 24 hours) on their own user page on that wiki while signed in as the account, and `ixnayid.startWikiVerification` / `confirmWikiVerification` / `unlinkWikiAccount` take only `iiwiki` or `althistory`. A verified sister link auto-approves a realm claim for a nation whose page that account created on that wiki; an Ixnay claim auto-approves when one of the claimant's approved IxWiki names (hidden ones count) created the nation's wiki page (`realms.claims.ts`). IxWiki is no longer offered there.

---

## Known gaps

- `getRealms` and `getWork` are not governed by any toggle (realm memberships and published work are always public).
- Pins cover ribbons only; the top cards follow the owner's pinned public showcase (pinned in the cards hub's Sets), else their value.
- The OOC community ribbons from the [ribbons spec](../specs/2026-08-10-achievements-ribbons-design.md) are not built.

## Related

- [Achievements](./achievements.md)
- [Settings](./settings.md)
- [WikiOS](./wikios/WIKIOS.md)
- [Vault](./myvault.md)
- [API Reference](../reference/api-complete.md)

---

## IxnayID identity deploy runbook (owner)

Plan A ships as one deploy (plan B, Lorewards, follows). Nothing here runs from a development machine; every command runs
in the production app directory. The conversion, the removal SQL and the tag backfill write; the counts and the dry runs
only read.

1. **Before: counts and the conversion dry run.** Check the release out on the server without deploying it (the same
   `git fetch` and `git reset --hard FETCH_HEAD` the deploy script starts with; the running app is not touched), then:

   ```bash
   bun scripts/identity/count-legacy-identity.ts > ~/ixnayid-counts-before.json   # read-only
   bun scripts/identity/convert-wiki-name-claims.ts                                # dry run: prints the plan, writes nothing
   ```

   In the counts, read:
   - `hiddenUsersWithNames`: players who had `showWikiAttribution` off. Their converted claims start hidden and stay
     private until each player turns the name on in Settings.
   - `contestedNames`: names two or more accounts hold or asked for (on the `ixstats_cards` clone: `Heku`).
   - `links`: verified by token, by an administrator, by a system owner, and unverified.

   In the dry run, read `conflicts` (a contested name becomes a `PENDING` claim for each account, none approved), the
   skips (`EXISTS`, `NAME_TAKEN`, `INVALID`) and the counts by note. A verified link becomes an `APPROVED` claim that
   keeps who verified it; its imported MediaWiki groups pass only when the account proved the link with its own token or
   a system owner confirmed it (an administrator's confirmation converts with `rightsPass` off). A link confirmed by hand
   before `wiki_account_links."verifiedById"` existed reads as self-proved, so record its confirming admin first
   ([wikios-v1-cutover.md](../operations/wikios-v1-cutover.md) step 1b). An unverified link or a legacy `wikiUsername`
   becomes `PENDING`. Settle anything surprising after the deploy in Admin, Users, Name claims:
   approve the right claim of a contested name and reject the others.

2. **Deploy.** `scripts/deploy-production.sh` runs, before `db push`, in order: the claims SQL
   (`20261103120000_ixnayid_claims`, additive), the conversion with `--apply` (claims plus one
   `WIKI_NAME_CLAIMS_CONVERTED` audit row; a re-run writes nothing, and a revoked or rejected claim never comes back),
   then the removal SQL (`20261103120001_ixnayid_drop_legacy`: deletes the IxWiki `wiki_account_links` rows; it refuses
   to run while one is there and the conversion left no marker). The deploy's `db:backup` dump comes first and is the
   way back. `"User"."wikiUsername"`, `"wikiUserId"` and `"lastWikiSync"` stay for this release: the old app reads every
   User column while the new one builds, and the new schema keeps them as `@ignore` fields it never reads.

   Then check that both partial unique indexes are there. Prisma 6.19's push never reads partial indexes, so it leaves
   them alone; if either is missing anyway, re-apply the claims SQL (idempotent):

   ```bash
   docker exec -i ixstats-postgres psql -U postgres -d ixstats -c '\d wiki_name_claims'
   # lists wiki_name_claims_one_approved_key and wiki_name_claims_one_pending_key
   bunx prisma db execute --schema prisma/schema --file prisma/migrations/20261103120000_ixnayid_claims/migration.sql
   ```

3. **Tag the claimed names' past revisions, once.** The conversion tags nothing, so the converted approved claims' old
   edits still have no author:

   ```bash
   bun scripts/identity/tag-claimed-revisions.ts           # dry run: each approved claim and how many revisions it would tag
   bun scripts/identity/tag-claimed-revisions.ts --apply   # tags; a second --apply tags 0
   ```

   Claims approved in the app later tag their own revisions, so this is a one-off. **`--undo`** takes back **every**
   live tag, not only this run's: the tags of claims approved or linked in the app since, and of revisions the inbound
   sync tagged, too. The claims stay approved and the revisions keep their text; only `authorId` returns to null, so
   contributions lose those edits until `--apply` is run again, which puts back every approved claim's tags. Use it
   only to back the whole backfill out.

4. **The curated alt.** The removed `KNOWN_WIKI_ALTS` mapped `Carthinova` (and `ixnet>Drunk Uncle Kir`) to `Kir`. Link
   `Carthinova` to Kir's account by hand: Admin, Users, Name claims, **Link an old name**. Make the link as a system
   owner if the name's imported groups should pass. The `ixnet>` name is an import label, not a claimable name.

5. **The handle cache is per process.** When a player picks a handle (`ixnayid.setHandle`, also from the WikiOS
   first-save dialog), the request-context cache entry for them is cleared only in the process that served the pick;
   another process keeps its cached copy for up to 5 seconds and would refuse their save as handle-less meanwhile. That
   is fine while production runs one app process; if it ever runs several, expect that short window.

6. **After.** Run the counts again (`bun scripts/identity/count-legacy-identity.ts > ~/ixnayid-counts-after.json`):
   `revisionsWithAuthorId` grows by the tagged revisions, and the IxWiki link counts read 0 (the legacy column values
   stay until the next release drops them). Check a few approved names: `User:<name>` opens the passport, and contributions list the old edits.

7. **The external Discord bot** (`/ixwiki/shared/bots/discord`, outside this repo) needs no change unless it reads the
   old link data straight from the database: check with
   `grep -rnE "wiki_account_links|wikiUsername|wikiUserId" /ixwiki/shared/bots/discord --include=*.js`. A read of
   `"User"."wikiUsername"` or of IxWiki `wiki_account_links` rows now fails or finds nothing; read approved
   `wiki_name_claims` instead (`status = 'APPROVED'`, and `visible` for anything shown in public). If it logs in to
   WikiOS's `/w/api.php` with a bot password, its old wiki-name login keeps working as an alias of the owner's handle.

8. **The next release drops the legacy columns.** Once this release runs in production, delete the three `@ignore`
   lines (`wikiUserId`, `wikiUsername`, `lastWikiSync`) from `model User` in `prisma/schema/core.prisma` and add, before
   the push in `scripts/deploy-production.sh` and the dev chain, an idempotent SQL file with
   `ALTER TABLE "User" DROP COLUMN IF EXISTS` for each. The app then running no longer reads them, so dropping them
   before the build is safe.

---

## Lorewards deploy runbook (owner)

Plan B (Lorewards) goes out in the same deploy as plan A and has no SQL. Nothing here runs from a development machine;
every command runs in the production app directory, and the read-only checks run with
`docker exec ixstats-postgres psql -U postgres -d ixstats -c "<query>"`. Steps 1 to 3 run before the deploy, once the
release is checked out on the server (plan A's step 1; the running app is not touched).

1. **Before: counts and duplicate spellings.** Keep these counts for step 9:

   ```sql
   select type, date ~ '^\d{4}-W\d{2}$' as iso, count(*) from loreward_entries group by 1,2;
   select count(*) from cards where "lorewardEntryId" is not null;
   select count(*), sum(credits) from vault_transactions where source like 'bonus:loreward:%';
   ```

   Then look for one name kept under two spellings in the stats table:

   ```sql
   SELECT lower(replace(username,'_',' ')), count(*), string_agg(username,' | ') FROM loreward_user_stats GROUP BY 1 HAVING count(*)>1;
   ```

   The Passport stat and the Lorewards achievements add up every spelling of a name (`lorewardStatsOfNames`), so a
   stale duplicate counts twice. Wins add up correctly, since each row counts only the entries recorded under its own
   spelling, but `totalScore` comes from the main OOL page, and a row left under an older spelling keeps its old score.
   Merge each pair the query finds: keep the spelling the OOL page uses now, and delete the other row (or set its
   `totalScore` to 0 while entries still record that spelling). `lower()` also pairs names that differ in case after
   the first letter, which MediaWiki treats as different people: leave those. The `ixstats_cards` clone has none.

   Then look for bot monthlies with no range. The new webhook gives a monthly keyed `YYYY-MM` its first and last day
   (UTC), so it is the same contest as the OOL page's `YYYY-MM-01` row; a row stored before has none:

   ```sql
   SELECT id, date FROM loreward_entries WHERE type='monthly' AND date ~ '^\d{4}-\d{2}$' AND "dateStart" IS NULL;
   ```

   Each row found is a second contest for its month and needs an admin fix. The clone has none.

   Then look for stats rows with points and no place (read-only): they show in the standings with nothing behind them.
   On the clone, Castadilla (778 points, no entry anywhere) was a fixture and was deleted there:

   ```sql
   SELECT username, "totalScore", "dailyWins", "dailyRunnerUps", "weeklyWins", "monthlyWins" FROM loreward_user_stats
   WHERE "totalScore" > 0 AND "dailyWins" + "dailyRunnerUps" + "weeklyWins" + "monthlyWins" = 0 ORDER BY "totalScore" DESC;
   ```

   Before deleting a row, check that no `loreward_entries` row names it as winner or runner-up; a real name with points
   and no place yet is fine.

2. **The old endpoint and the cron runner.** `/api/lorewards/sync` is deleted. Look for a call to it in the server's
   crontab and remove the line:

   ```bash
   crontab -l | grep -n "lorewards/sync"
   grep -rn "lorewards/sync" /etc/cron.d /etc/crontab
   ```

   (`/api/bot/lorewards/sync` is the bot webhook and stays.) Then stop the cron runner, `pm2 stop ixstats-cron`, so the
   old 10-minute state sync stops writing date-keyed weekly rows while the merge runs, and change its job list for the
   new code: in `ecosystem.config.cjs`, replace `lorewards-state-sync` with `lorewards-ool-backfill` in
   `CRON_ENABLED_JOBS` and keep `lorewards-full-sync`. The deploy starts it again (step 5).

3. **The weekly merge, before the new code goes live.** The new syncs key every weekly by its UTC ISO week, so merge
   the date-keyed rows first:

   ```bash
   bun scripts/lorewards/merge-weekly-keys.ts           # dry run: prints counts, skipped and folds as JSON, writes nothing
   bun scripts/lorewards/merge-weekly-keys.ts --apply   # applies each merge in its own transaction
   bun scripts/lorewards/merge-weekly-keys.ts           # again: 0 merges
   ```

   Read `skipped` in the dry run: each week it leaves alone, with the reason (`different first days`,
   `different holders`, `paid twice`, `carded twice`, `overridden or not approved`, `no first day`). On the clone the
   merge made 211 merges and skipped five weeks: 2024-W20, 2026-W01, 2026-W13, 2026-W14 and 2026-W18. Production may
   differ, so work from its own list. Each skipped week is settled by an admin override in step 6.

4. **Deploy.** `scripts/deploy-production.sh`, with plan A's steps (plan B adds no SQL).

5. **Cron.** The deploy script's `pm2 startOrReload ecosystem.config.cjs --update-env` starts the cron runner with the
   list from step 2 (if it did not, `pm2 restart ixstats-cron --update-env`). The OOL backfill runs hourly at
   `20 * * * *` (the current year's OOL page, then it settles what it wrote); the full sync runs at 06:00 UTC. The
   runner exits on any unknown name left in the list (`[Cron] FATAL: unknown job name(s)`), so check
   `pm2 logs ixstats-cron` after the restart.

6. **Skipped weeks.** Run the merge's dry run again: the old app, until the restart, could still write a date-keyed
   weekly (the old webhook, or the OOL read inside a page view), so apply again if it plans any merge. Then settle each
   skipped week in Admin, Bot, Lorewards, **Manual winner override tool**: an override of the week's winner is written
   to every row of its contest and no sync writes over it.

7. **The trophy backfill.**

   ```bash
   bun scripts/backfill-loreward-trophy-cards.ts           # dry run: the places missing a card, and the cards waiting for a claim
   bun scripts/backfill-loreward-trophy-cards.ts --apply   # mints and gives; a second --apply mints 0
   ```

   It mints a card for every place since 2017 and gives the ones whose name has an approved claim (or whose `wikios>`
   name resolves); the rest wait, and each later claim approval gives them out. It pays nothing. On the clone the first
   apply minted 2,846 cards and granted 0 (no claims were approved), and a second run minted 0.

8. **Pay.** Check bonuses are on (Admin, Cards, Economy), then press **Pay now** (there in Loreward payouts, or in
   Admin, Bot, Lorewards), or wait for the 06:00 UTC full sync. Places from 15 October 2026 whose names have approved
   claims (the conversion's included: the conversion runs no hooks) pay once; the toast says how many places were paid
   and how many trophy cards were minted and given, or "Loreward bonuses are off". Pressing it again pays 0.

9. **After.** Run the counts of step 1 again: no date-keyed weekly rows beyond the skipped weeks'
   (`select count(*) from loreward_entries where type='weekly' and date !~ '^\d{4}-W\d{2}$'`), about one trophy card
   per contest place, and new `bonus:loreward:` rows only for places from 15 October 2026. Open the Vault Lorewards tab
   as a player with an approved claim and check their cards and payouts.

10. **The Discord bot** (`/ixwiki/shared/bots/discord`, outside this repo). The bot must POST every approved daily,
    weekly and monthly result to `https://ixwiki.com/projects/ixstates/api/bot/lorewards/sync` with
    `Authorization: Bearer <BOT_API_KEY>` (or `x-bot-api-key`) and the body fields the route reads (`date`, `type`,
    `winnerUser`, `winnerPage`, `winnerScore`, `winnerBytes`, `runnerUpUser`, `runnerUpPage`, `runnerUpScore`,
    `runnerUpBytes`, `status`, `metadata`). A weekly's `date` is its ISO week in UTC (`2026-W43`) or its first day; a
    monthly's stays as it sends it today (a `YYYY-MM` key gets its first and last day as its range). Check whether it
    posts already (`grep -rn "lorewards/sync" /ixwiki/shared/bots/discord`); if it only writes `lorewards-state.json`,
    add the POST after it approves a result. Answers: 200 with the stored entry and what was settled; 400 when the date
    cannot be read; 409 when the week's key holds another week (another first day), which needs an admin override of
    that week.

11. **The admin blacklist still reads the bot's state file.** `lorewards.getBlacklist` (Admin, Bot, Lorewards,
    **Silent blacklist manager**) reads `/ixwiki/shared/bots/discord/lorewards-state.json`, by design (plan B's open
    decision 7: it is not a results sync). The bot may keep writing the file.

12. **Watch `exclusiveWikiosNames`.** The Lorewards achievements loader runs it for an account on every evaluation
    (`src/lib/lorewards/account-names.ts`): it groups the account's ixwiki revisions by author and checks each author
    against other accounts' revisions. Its cost grows with tagged revisions, so once plan A's tag backfill (step 3) has
    run, watch it in the weekly slow-query digest.

### Known limits

- A revoke that races a sync can leave a trophy card with the former owner. Nothing sweeps it back; an admin override
  of its place fixes it.
