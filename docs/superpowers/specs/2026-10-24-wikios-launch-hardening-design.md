# WikiOS launch hardening (IxStates launch, no ixwiki.com takeover)

Date: 2026-10-24 · Owner decisions gathered in conversation on 2026-10-24 · Inputs: the WikiOS core audit and the wiki integrations audit run the same day (findings referenced below by their IDs: core B1–B4, I1–I11; integrations IB1, II1–II9).

## Intent

Make WikiOS gold for the IxStates launch: **zero data loss, render parity with MediaWiki, speed, and a reliable visual editor, all beyond doubt**, with full sister-wiki support, in the launch shape the owner chose: WikiOS serves the wiki inside IxStates only, while ixwiki.com stays classic MediaWiki, public and editable.

## Launch shape (owner, 2026-10-24)

- IxStates stays at **ixwiki.com/projects/ixstates** (`BASE_PATH=/projects/ixstates`); WikiOS is its wiki. ixwiki.com stays **classic MediaWiki**, public and editable. The takeover kit (standalone `wikios` process, nginx `wikios-takeover.conf`, `/classic/` article path, `wikios-localsettings` takeover parts, runbook step 8) is **deferred** and must not be applicable by mistake.
- **Conflicts: last writer wins, never silent.** When WikiOS and classic both change a page from the same base, the later save (by actual save time) stands on **both** wikis, and the overwritten editor is always told: an in-app notification (and Discord DM when linked) with the diff and a one-click restore of their text as a new edit; a short bot note on their classic user talk page; an edit-summary trail on the winning revision naming the overwritten one, on both wikis; and an entry in an admin conflict log. This replaces "park" (WikiOS primary).
- **Canonical and share URLs stay on classic ixwiki.com** (today's behaviour). IxStates must not advertise a sitemap or robots rules that only make sense on the takeover host.
- **Bots move to WikiOS `/w/api.php`** (signed bot passwords); their edits mirror out to classic.
- **Classic is the authority for blocks, user groups and `MediaWiki:` interface messages.** WikiOS imports them and refuses its own `MediaWiki:` edits until a takeover.
- **Sister wikis (iiwiki, althistory): full support** — links everywhere, previews and embeds, resilience, and cross-wiki transclusion. Sister reader pages (`/wiki/X?source=…`) are **not indexed**.
- **Launch mode:** `WIKIOS_V1_ENABLED` on (background renders, lore cards, search and sync on); the admin switch is redundant in that mode.
- **Proof:** the render-parity, round-trip and benchmark harnesses run against the **full production corpus** before launch, reports kept, and then as a **recurring gate** (scheduled, and before every deploy that touches WikiOS).
- **Production steps** (the "launch without takeover" runbook) are run at the launch deploy by Claude over SSH, step by step, with the owner (exception to the no-touch rule, WikiOS steps only). Production today runs a 2026-09-03 build with the app stopped; nothing changes on the server before launch.

## Workstreams

### A. Data safety (zero data loss)

1. **Last writer wins, never silent** (replaces park; fixes core B1 by construction): one decision function for inbound (classic → WikiOS) and outbound (WikiOS → classic) collisions, independent of `WIKIOS_V1_ENABLED` vs the admin switch (the rule follows "WikiOS takes writes"). Both wikis converge to the winner. Owner rules (2026-10-24, from the builder check):
   - **Clock:** a WikiOS save counts at its WikiOS commit time; a classic save at its MediaWiki `rev_timestamp`. Imports, undeletes and restores count at the moment they happened, not their original dates. A tie within the same second goes to classic. The silent `pushAsEdit` force-push fallback is retired: an outbound WikiOS revision that lost becomes a history-only import (never current).
   - **Who is told:** every distinct author on the losing branch, once per collision; one conflict-log row per collision listing every overwritten revision (the idempotency key that dedupes webhook vs cycle).
   - **Channels per editor:** classic-only and IP editors get the classic talk-page note (diff + link to their revision; restoring means re-editing on classic). WikiOS editors with no classic name (`wikios>` labels) get the in-app notice only. The one-click restore lives in WikiOS for signed-in editors.
   - **One write path:** talk-page notes and trail edits are written in WikiOS and mirrored out like any edit (never written straight to classic by the mirror account), so nothing loops or reads as an echo.
   - **Trail:** when WikiOS's save won, the trail goes in its own summary before mirroring; when classic's save won, a dummy edit (no text change) carries the trail on both wikis. One extra history line per collision is accepted.
   - **Deletes, moves, undeletes:** covered; any later action wins (an edit after a delete brings the page back; a delete after an edit removes it; moves likewise); losers told the same way.
   - **Late mirror:** lateness never changes the outcome; a queued job whose revision lost becomes a history-only import and its author is told; losing revisions stay in both histories.
   - **Existing parks** (builder's call, none in production): relabelled as overwritten records with no retroactive notices; `repushSkippedParks` and `wikiAutoSync.repushSkipped` retired.
2. **Never apply an older revision over a newer head** (core B2): ordering by MediaWiki revision id / timestamp, so a webhook-then-cycle replay cannot roll a page back.
3. **Protections before writes** (core B3): turning editing on (admin switch or v1) refuses until the protections import has run (a marker key written by the import); the runbook makes steps 1/1b mandatory.
4. **Mirror queue health** (core I4): dead jobs leave the runnable window; an admin requeue/discard tool; an alert when the window saturates.
5. **Inbound sync cannot stall** (core I5): a step failing N times is quarantined to a dead-letter row and the high-water mark advances.
6. **Rollback conflict check** (core I6): rollback passes the head it read as `expectedHeadRef`.
7. **Saves**: re-check `ARCHIVED` inside the save transaction (core minor); skip revisions and mirror jobs for null edits (core minor); a dedicated wiki-save rate limit per group (new vs autoconfirmed), far below today's 100/min (core I7).
8. **Admin-data authority** (core I2, I10): WikiOS imports classic blocks and groups and refuses `MediaWiki:` edits; XML imports into WikiOS are restricted to MediaWiki-origin dumps (non-MW imports would never mirror, core I3).
9. **Tests for the production mode** (core I11): the suite runs both modes (v1 on; editing on with v1 off); restore the guard tests deleted in `f5bf69fa9` where they still apply.

### B. Integration and hosts

1. **Sync webhook reaches IxStates** (integrations IB1): the MediaWiki-side webhook URL is configurable and points at the IxStates app (`:3550` + base path), not the takeover process.
2. **Close the open reverse proxy** `/api/ixwiki-proxy/:path*` (II1).
3. **Loopback renderer required** (II2): server-side MediaWiki calls use `WIKIOS_MEDIAWIKI_INTERNAL_URL`; the runbook adds the server IP and `IxStats-Builder` to the bot-defense and fail2ban allowlists.
4. **In-app links stay in WikiOS** (II3): fix the plain `/wiki/` anchors (base path), keep `Special:`/`File:` links inside WikiOS (except `Special:FilePath`).
5. **Hover previews under the base path** (II4) and for `?source=`/althistory.
6. **Feeds and permalinks** (II7, II8): build from titles with `wikiReaderPath` on `NEXT_PUBLIC_APP_URL` + base path; no hard-coded `ixstats.com`, `/projects/ixstates` or `maps.ixwiki.com`.
7. **Robots and sitemap** (core I1, II9): canonical stays classic; IxStates' robots rules apply only to its own paths, disallow `?source=`, and drop the takeover sitemap line.
8. **Bots on `/w/api.php`**: bot-password setup documented; the Discord bot and Lorewards writers repointed (the Discord bot repo is not on the dev machine; its change goes in the runbook).

### C. Sister wikis, full support

1. **Links everywhere** (II5, core I9): interwiki links in rendered articles rewritten to the in-app reader with `?source=`; composer wiki links, Discord markdown, admin link tools and media search carry the source.
2. **Previews and embeds** for iiwiki and althistory.
3. **Resilience** (II6): typed upstream errors ("wiki unavailable", never empty results), breaker trips on timeouts/5xx, a per-host outbound limiter, server cache headers on the api.php proxy.
4. **Cross-wiki transclusion** (owner decisions, 2026-10-24): written as an ordinary template, `{{Sister|iiwiki|Title}}` with an optional mode: the whole page (default), `section=<heading>`, `infobox=yes`, or `card=yes` (lead paragraph and image as a card linking to the sister page). WikiOS renders the real embed **live, cached** (about an hour) with a "wiki unavailable" fallback, through the sister render path (that wiki's own parser, sanitized). Classic ixwiki.com renders `Template:Sister` as a small link box ("From iiwiki: Title"); creating that template on classic is a runbook step (Template namespace is admin-only). The template round-trips losslessly through the editor and the mirror (it is plain wikitext on both wikis).

### D. Proof and docs

1. **Gold proof**: run `scripts/audit/wikios-render-parity.ts`, `wikios-roundtrip.ts` and `scripts/bench/wikios-bench.ts` over the full corpus (locally against a production-corpus copy; the benchmark also at launch on the server), store the reports, and add the recurring gate (cron job + pre-deploy check) with thresholds.
2. **Docs**: SYSTEM_STATUS, `docs/systems/wikios/WIKIOS.md` (version, modes), `mediawiki-dependencies.md`, the cutover runbook rewritten as **"launch without takeover"** (steps 1, 1b, 1c, 3, 4, 6, 6b, 10b plus the new ones above; the takeover steps parked in a separate deferred section), the scope file marked superseded.
3. Debt: `console.log` in `auto-sync-service.ts`, the WikiMarginDrawer TODO.

## Order

A (data safety) first, then B, then C1–C3, then C4, then D; the native-lore plan resumes after A (its writes depend on the save path).

## Constraints

- CLAUDE.md rules (bun, no global tsc/next build, Jest `--maxWorkers=1`, dead code 0, Facet, import direction). No production changes before the launch deploy. Schema changes ship as idempotent migrations applied to the clone only.
- Every behaviour change in the sync, mirror or save path lands with a test that fails first, in both modes.

## Left to the builder

- The exact conflict-log schema, notification copy and talk-page note wording (sentence case, no em dashes).
- Rate-limit numbers per group (start from MediaWiki's defaults).
- Gate thresholds for the recurring proof (start from the first full-corpus run).
