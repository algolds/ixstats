# IxnayID identity and Lorewards: design (owner-approved, 2026-10-23)

## Why

WikiOS is the wiki now (it serves ixwiki.com/wiki/*; classic MediaWiki stays editable alongside). Identity still runs through legacy IxWiki account linking: a token on your wiki user page, `WikiAccountLink` rows, and an unverified `User.wikiUsername` field with a privacy switch (`showWikiAttribution`). This causes four problems:

- **Lorewards are empty.** In the `ixstats_cards` clone, every IxWiki link is unverified. So:
  - the Vault Lorewards tab shows "No wiki edits yet" to everyone;
  - it hides the trophy cards players already own;
  - payouts never pay.
- **Edits are attributed to the wrong names.** Native WikiOS edits are credited under the unverified `wikiUsername`, else the country name. Imported MediaWiki edits reach an account only through a verified link: 0 of 392 revisions in the clone have an `authorId`.
- **The Passport and the Vault disagree.** The Passport reads the unverified name (773 points); the Vault reads the verified link (nothing).
- **Lorewards is half-wired:**
  - payouts are never triggered;
  - the 10-minute sync reads a production-only state file;
  - no real trophy cards exist;
  - WikiOS barely shows Lorewards.

The audits behind this design were read-only:
- Lorewards: `.superpowers/sdd/441-lorewards/` notes.
- Legacy identity: about 105 source files and 62 test files across 14 areas.

**Success:**
- The IxnayID/Passport account is the only identity for IxWiki and WikiOS.
- Old IxWiki names reach accounts only through claims an admin approved.
- Every reader of "who is this wiki name" asks one resolver.
- Lorewards shows, pays and mints for the right accounts.
- Nothing that worked through links breaks during the move.

## Decisions (the owner's)

### Identity

1. **IxWiki account linking is removed:**
   - the verify-your-IxWiki-account flow;
   - IxWiki rows in `WikiAccountLink`;
   - `User.wikiUsername`, `wikiUserId` and `lastWikiSync`;
   - the `showWikiAttribution` switch;
   - the static MediaWiki reconciliation matrix.

   IIWiki and AltHistory linking is kept, under IxnayID/Passport.
2. **New users use WikiOS natively,** with no wiki account.
3. **Name claims.**
   - An account may hold several old IxWiki names (alts, renames). A name belongs to one account at most.
   - A player requests a name in **Settings → IxnayID & Passport**.
   - An admin approves or rejects it in an **admin queue**, on their own judgement.
   - **Admins can also link a name to an account directly,** for legacy users who never used the old link.
4. **Admin name search** covers:
   - WikiOS revisions (`wiki_revisions.author`);
   - Lorewards names (stats, winners, runners-up);
   - MediaWiki's user list (`list=allusers`, read-only).

   Each result shows the name's edit count, Lorewards standing, and any imported rights or blocks.
5. **Imported MediaWiki rights** (plan 409's `wiki_user_groups`, keyed by name) pass to the account only when a **system owner** approves the claim or makes the link. Blocks (`wiki_blocks`) always follow the name.
6. **When a claim is approved:**
   - The name's past revisions are tagged with the account (`authorId`). This is logged and undone if the claim is revoked. Contributions, autoconfirmed status and achievements then count them.
   - Unpaid Lorewards places from the payout start (2026-10-15) are paid, and their trophy cards minted. Each place pays exactly once.
7. **Revoking a claim** undoes the revision tags. Payouts already made stay paid. *(Builder's call: stated to the owner as a guess before they approved; flag it if review finds a problem.)*
   - *Owner amendment (2026-10-23):* a revoke also moves the name's trophy cards. The former owner's copies are voided (a `VOID` transfer event, no audit row) and each card goes to the name's next approved owner, with serial 1 reissued. IxC already paid stays paid.
8. **Converting production data:**
   - Verified IxWiki links become **approved** claims, keeping who verified them. That keeps the system-owner rule for rights.
   - Unverified links and legacy `wikiUsername` values become **pending** claims.
   - Players who had turned wiki attribution off keep their converted claims private until they confirm in Settings. Until then the name shows nowhere.
9. **The edit author** is always the player's **passport handle** in WikiOS.
   - When WikiOS mirrors an edit to classic MediaWiki, it is recorded under the player's **claimed name** if they have one, else as `wikios>handle`.
   - A player with no handle picks one in a small dialog the first time they save in WikiOS, prefilled from their name.
10. **User pages.** `User:<handle>` and `User:<claimed name>` both redirect to the owner's **Passport**. An old user page's text stays in its history, and in classic MediaWiki.
11. **Bot passwords** (the bot API) belong to the account and log in as `handle@App`. A claimed name works as an alias, so existing bots keep running.
12. **Ixnay realm claims** auto-approve when one of the claimant's approved names created the country's wiki page. IIWiki and AltHistory realms keep using their sister-wiki links.
13. **Sister wikis.** The Settings panel keeps IIWiki and AltHistory linking, relabelled "Sister wikis". IxWiki is no longer offered there.

### Lorewards

14. **What counts.** Edits made in WikiOS credit the player's account. Classic MediaWiki edits by a **claimed** name credit that account too. Unclaimed names still compete publicly, under their wiki name.
15. **The Vault Lorewards tab** always shows:
    - the player's own trophy cards and Loreward achievements;
    - today's race;
    - the standings.

    With no claimed name, it adds a pointer to Settings → IxnayID & Passport to claim one.
16. **Sources.** The Discord bot's webhook (`/api/bot/lorewards/sync`) is the primary source of official results. Reading IxWiki:OOL backfills any gaps. The production-only state-file sync is retired.
17. **Payouts** run inside every sync (the webhook, the daily full sync and the OOL backfill), idempotent per place. Admins also get a **"pay now"** action. The payout grid is unchanged.
18. **The week** is the ISO week in UTC, keyed `YYYY-Www`. The date-keyed weekly duplicates merge into the ISO keys.
19. **Trophy cards** are backfilled for every place since 2017. A place's card mints to its owner once the name is claimed.
20. **WikiOS surfaces:**
    - a Lorewards entry in WikiOS's navigation, pointing to the existing `/util/lorewards`;
    - a "today's race" chip in the reader's margin drawer (your score and the leader).

    Out of scope, as the owner didn't pick them: a user-page block (delete the unused `wikios.getAuthorProfile`), a save toast, and a Passport trophy shelf.
21. **Passport.** The rank-and-points stat and its sheet stay, now reading the player's claimed names through the resolver.
    - The "Lorewards standing" Overview panel the help describes was never built. Remove it from the help.
22. **Achievements** for Lorewards wins follow the same rule: wins by a claimed name, or by the account's WikiOS edits, count. Wins credited to the mirror account `wikios>` finally unlock them.

## Constraints

- **Databases:** work runs against `ixstats_cards` only, never `ixstats` or `ixstats_wv1`. The owner runs production, including the conversion.
- **Schema:** additive SQL first (the claims table and the revision-tag log), wired into the dev SQL chain and the deploy runbook. Column and table removal comes last, in its own SQL file, after every reader has moved.
- **Order** (nothing may break mid-way):
  1. read-only production counts and the runbook;
  2. the claims table and conversion script;
  3. the resolver, with every reader moved onto it;
  4. native handles, user-page redirects and bot passwords;
  5. Lorewards;
  6. removal of the old fields and their tests.
- **Money:** a payout is idempotent per place. Tests cover a wrong claim, a revoke and a re-approve, and paying twice must be impossible. Existing card and vault lock orders are unchanged (see `docs/systems/cards.md` and the vault docs).
- **Security:** keep plan 409's rule. Only a system owner's approval passes imported sysop or bureaucrat rights.
- **Outbound calls:** wiki calls use `User-Agent: IxStats-Builder`. From this dev machine, iiwiki.com is reached through the relay.
- **External:** the Discord bot lives outside this repo (`/ixwiki/shared/bots/discord`). Any change it needs goes into the owner's runbook. Nothing is deployed from here.
- **House rules:**
  - the cards SDD rules (`plans/cards-refresh-sdd/common.md`), adapted to this worktree;
  - TDD, no `any` or `unknown`, Facet UI rules;
  - architecture rules: routers thin, no modules-to-modules imports, lib pure;
  - commits by explicit path;
  - no version or changelog changes.

## What is built

### Identity phase (plan A)

1. **Schema.**
   - A `wiki_name_claims` table: account, source `ixwiki`, normalised name, status (pending, approved, rejected, revoked), `visible`, who requested and who decided, evidence or note, timestamps, and how it was made (player, admin link, conversion).
   - A unique approved owner per name.
   - A `wiki_revision_claim_tags` log for reversible `authorId` tags.
2. **The claims module.**
   - request, approve, reject, revoke, and admin direct link;
   - the system-owner rule for rights;
   - the approval side effects: revision tags, plus a Lorewards hook that plan B fills;
   - an audit entry for each action.
3. **The resolver.** `ownerOfName(source, name)` and `namesOfUser(userId)` use only approved claims. They replace every link lookup:
   - inbound sync and the XML importer;
   - the mirror's author;
   - the watchlist editor check;
   - rights, pending groups, blocks and autoconfirmed;
   - realm auto-approval;
   - achievements;
   - profiles and contributions;
   - api-compat bot logins;
   - Lorewards' `resolve-user`.
4. **Settings.** The IxnayID & Passport panel:
   - claim a name, with its status and the private/visible confirmation;
   - "Sister wikis" (IIWiki, AltHistory) in place of the IxWiki verify row.
5. **Admin.**
   - A claims queue: pending claims with each name's evidence, approve, reject, revoke.
   - A "link a legacy name" tool: name search across the sources in decision 4, then an account picker.
   - The old `linkUserWiki`/`unlinkUserWiki` and the reconciliation matrix are retired.
6. **Native identity.**
   - The edit author is the handle, and the mirror author is the claimed name else `wikios>handle`.
   - The handle-picker dialog on first save.
   - `User:` redirects to the Passport.
   - The own-user-page policy is updated.
   - Bot passwords by handle, with claimed-name aliases.
7. **The conversion script.** Verified links become approved claims, unverified links and `wikiUsername` values become pending claims, and hidden names stay private. It has a dry run with a report, and an apply that is idempotent.
8. **Removal** (last):
   - `User.wikiUsername`, `wikiUserId`, `lastWikiSync`;
   - `showWikiAttribution` and its roughly 20 call sites;
   - IxWiki rows and code paths in `WikiAccountLink`, keeping the sister wikis;
   - the reconciliation matrix and `wiki-mappings.ts`;
   - the IxWiki verify UI;
   - the affected tests.

### Lorewards phase (plan B)

9. **Vault tab:** fix `loadMyTrophies`' early return. Show owned cards, achievements, today's race and the standings always; add the claim pointer.
10. **Sync:**
    - the webhook is primary and the OOL backfill fills gaps;
    - the state-file sync is retired;
    - the cron config is updated, and the runbook too.
11. **Payout:** pay inside every sync path, idempotent, plus the admin "pay now". The claim-approval hook from plan A pays and mints on approval.
12. **Weeks:** the ISO week; a migration merges the duplicate weekly keys.
13. **Trophy backfill:** run `scripts/backfill-loreward-trophy-cards.ts`, fixed as needed, for every place since 2017. Cards for unclaimed names wait until their claim is approved.
14. **WikiOS:** the nav entry and the margin race chip.
15. **Passport:** the stat and sheet read the resolver, and the help is fixed.
16. **Achievements:** wiki metrics read the resolver's names plus the account's own revisions.
17. **Data quality:** clean the fixture rows on the clone. Leave `winnerPage` nulls to the bot and OOL.

## Left to the builder

- Table and column names, and the claim-normalisation rules (MediaWiki rules: first letter upper case, underscores as spaces).
- The handle dialog's layout, within Facet.
- The admin queue's layout.
- Paging and limits.
- How the Lorewards hook is shaped between plans A and B.
- Exact task boundaries, and which tasks can run in parallel (three implementers at most).
