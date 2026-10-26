# WikiOS gold proof

WikiOS launches only if it renders like MediaWiki, keeps every byte through the visual editor and is at least as fast,
and it must keep doing so after every release. This folder holds the proof: the committed summaries and `latest.json`,
which the deploy reads. The full reports are too large to commit; see [Where the reports live](#where-the-reports-live).

The CLI is [`scripts/audit/wikios-proof.ts`](../../../scripts/audit/wikios-proof.ts). Its rules live in
[`scripts/lib/wikios-proof-gate.ts`](../../../scripts/lib/wikios-proof-gate.ts) (pure, unit-tested) and its thresholds in
[`scripts/audit/wikios-proof-thresholds.json`](../../../scripts/audit/wikios-proof-thresholds.json). Background:
[WIKIOS.md, Proof and gates](../../systems/wikios/WIKIOS.md#proof-and-gates) and the
[launch hardening spec](../../superpowers/specs/2026-10-24-wikios-launch-hardening-design.md) (Workstream D).

**Reports so far:**

- [2026-10-26, local](2026-10-26-local.md) (commit `72b282b77`, `latest.json`): passed. The round trip kept 12,706 of
  12,706 pages byte-identical, in every namespace. Parity compared a sample of 497 pages, each at the revision WikiOS
  holds: 99.2% of the 495 scored pages score 98 or more, the mean is 99.88 and none is below 70 (two pages failed on
  classic's side with an internal error; three `sanitized-css` pages were left out as not articles). The bench is
  reference only on a dev server; the gated bench is the launch run. Every WikiOS article page request of that bench
  failed, for a reason of the dev server's, not WikiOS's ([below](#the-local-benchs-page-requests)).

## What each harness measures

- **Editor round trip** ([`scripts/audit/wikios-roundtrip.ts`](../../../scripts/audit/wikios-roundtrip.ts)). Each page's
  stored wikitext goes through the visual editor's own converters (`wikitextToAst`, `astToPlateNodes`,
  `serializePlateToWikitext`) with no edit, and the output is compared with the input byte for byte. The proof runs it
  over every page of every namespace in the database. It reads Postgres only, and refuses any database that is not on
  localhost or that is on port 15433 (the SSH tunnel to production).
- **Render parity** ([`scripts/audit/wikios-render-parity.ts`](../../../scripts/audit/wikios-render-parity.ts)). For each
  page it fetches MediaWiki's render and WikiOS's (`wikios.getArticleHtml`), reduces both to text (with a break at each
  cell, row and block, as a reader sees it), links, images, headings and structure, and scores the pair from 0 to 100
  (text 50, links 20, images 15, headings 10, tables and infobox 5; a part empty on both sides is left out). MediaWiki
  renders the revision WikiOS holds (`action=parse&oldid=`, from the corpus's revisions file), so an edit on classic
  since WikiOS's copy is not scored as a difference; a revision MediaWiki has deleted or hidden since counts as corpus
  drift. A page whose revision is not wikitext (a `sanitized-css` page in the main namespace, say) is left out of the
  sample by its content model: it is not an article. A WikiOS view that is still a fallback or a stale render is
  fetched again after a wait, up to three times. A page that fails records which side failed.
- **Bench** ([`scripts/bench/wikios-bench.ts`](../../../scripts/bench/wikios-bench.ts)). For each page it times the
  MediaWiki article page, the WikiOS article page and its data call, title search on both, and history on both. The
  comparison is p95 over every run.

## The three profiles

| Profile | Where | What it runs | Command |
|---|---|---|---|
| `local` | this machine, against the `ixstats_proof` clone | the full round trip; parity over a 500-page sample against classic's public `api.php`, at most one request every 2 s; the bench (25 default pages, 2 runs) as reference only, since a dev server says nothing about production speed | `bun scripts/audit/wikios-proof.ts run --profile local --wikios http://localhost:3200` |
| `launch` | the server, at the launch (`NODE_ENV=production`) | the full round trip; parity over the whole corpus against the loopback renderer (`WIKIOS_MEDIAWIKI_INTERNAL_URL`) and IxStates on `127.0.0.1:$PORT$BASE_PATH`; the bench over 200 pages, 2 runs, through the public URLs | `bun scripts/audit/wikios-proof.ts run --profile launch` |
| `recurring` | the server, weekly | as `launch`, with a parity sample of 200 and a bench of 50 pages, 1 run | the `wikios-proof` cron job; by hand, `bun scripts/audit/wikios-proof.ts run --profile recurring` |

### The local bench's page requests

In the 2026-10-26 local run all 50 WikiOS article page requests of the bench (25 pages, 2 runs) failed with "The
response redirected too many times", so `bench.failures.wikios` measured 25% and the page rows have no samples. The
cause is the dev server's Clerk development instance: it answers a request with no session cookie and
`accept: text/html` with a redirect to its handshake, and the bench's fetch, which keeps no cookies, follows it round.
Production keys do not do that: a cookie-less `text/html` request for the live `maps.ixwiki.com/dashboard` answers 200.
The local profile does not gate the bench, so the proof passed; the launch profile does, and there a
`bench.failures.wikios` failure that says "redirected too many times" means IxStates is running development Clerk
keys (runbook step 7e), not a WikiOS fault.

Only a `local` or a `launch` run can prove a release. The other commands:

- `bun scripts/audit/wikios-proof.ts gate --profile <p> --roundtrip <f> --parity <f> [--bench <f>] [--out-dir <d>]` checks
  existing reports against the thresholds again (after a threshold change, for example). The reports must be one run's,
  in its run directory: the new summary takes its commit, tree key and dirty flag from that run's own `summary.json`
  (never from the checkout's HEAD, which may hold newer code), and `gate` refuses when that file is missing or
  unreadable.
- `bun scripts/audit/wikios-proof.ts predeploy` is the deploy's check (below); `deployed` releases the lease it took.
- `bun scripts/audit/wikios-proof.ts --help` lists every flag.

The weekly job is `wikios-proof` in `src/server/cron/jobs.ts`: Monday 05:30 UTC (SystemConfig `cronSchedule_wikiosProof`
overrides it), and off until it is named in `CRON_ENABLED_JOBS`. It kills a run after 80 minutes, and a failure posts the
failing checks through the cron failure alert.

## Thresholds

Each line is one check. The bench checks apply to the server profiles only; a `local` run lists them as skipped. Besides
these, each harness must exit cleanly, a proving round trip must cover every namespace (`roundTrip.namespaces`), and a
parity report must record its settle wait (`parity.settleMs`) and have parsed the revision WikiOS holds
(`parity.byRevision`).

- `roundTrip.pages`: at least 11,435 pages measured (90% of the first proof's 12,706), so an empty or wrong corpus
  cannot pass.
- `roundTrip.nonIdentical`: 0 pages whose output differs from their input by any byte.
- `roundTrip.incomplete`: 0 pages the serializer could not finish.
- `roundTrip.errors`: 0 pages that threw.
- `parity.pages`: at least 200 pages answered (scored, or missing on MediaWiki), and every requested page in the report.
- `parity.wikiosFailures`: 0 pages WikiOS failed to serve.
- `parity.fallbackRenders`: 0 scored pages still a fallback or stale render after the settle retries.
- `parity.mediawikiMissing`: at most 2% of requested pages missing on MediaWiki, or whose held revision MediaWiki has
  deleted or hidden (corpus drift between the two copies).
- `parity.leftOut`: at most 2% of the requested sample left out by content model, each named (a fixed cap in the gate,
  not in the thresholds file). The corpus has 24 `sanitized-css` pages among 4,771 articles (0.5%), and the first proof
  left out 3 of 500; more than 2% would mean the exclusion hides articles.
- `parity.atLeast98`: at least 97.1% of scored pages score 98 or more (the first proof measured 99.2%).
- `parity.meanScore`: a mean score of at least 98 (the first proof measured 99.88).
- `parity.below70`: 0 pages below 70, except pages listed in `knownLowPages` with a reason.
- `bench.failures.<system>`: at most 1% of requests failed, per system.
- `bench.p95.<metric>`: p95 caps of 1,500 ms for `page+data.totalMs` (the article page and its data call), 800 ms for
  `data.totalMs`, 500 ms for `search.totalMs` and 800 ms for `history.totalMs`.
- `bench.ratio.<metric>`: WikiOS's p95 no worse than MediaWiki's (ratio 1.0) for `page+data`, `search` and `history`.

**What "acceptable" means.** A score of 98 or more is "identical or acceptable": once both renders are normalised, their
text, links, images, headings and structure agree, and what is left is markup that a reader does not see. It is the
score's top bucket, and the `parity.atLeast98` share is the headline parity number.

## The ratchet rule

Thresholds only rise. After a proof, a threshold may move up to what was measured, less a margin:
`roundTrip.minPages` to 90% of the measured pages, `parity.minAtLeast98Percent` to the measured share less 2 (never below
95), `parity.minMeanScore` to the measured mean less 1 (never below 97). Lowering any threshold, or adding a
`knownLowPages` entry, needs the owner. A proof that misses a floor is not fixed by moving the floor: fix WikiOS, or ask the
owner.

## Running the local proof

The local proof needs a copy of the production corpus and a dev server on a clean checkout. The gitignored helpers
`plans/wikios-v1-tools/make-proof-clone.sh` and `run-dev-proof.sh` do the first two steps; without them:

1. **Make the clone.** Dump the local dev copy (`docker exec ixstats-postgres pg_dump -U postgres -Fc ixstats`, which only
   reads it), create a database named `ixstats_proof` in the same container and restore the dump into it with
   `pg_restore --no-owner`. Apply to the clone, in order and stopping on the first error: the
   `prisma/manual-migrations/*wikios*.sql` files of runbook step 1 (without `lead-image-canonical-path`), then every
   `prisma/migrations/2026110*/migration.sql` that `scripts/deploy-production.sh` lists, in its order. If the clone still
   lags the schema, run `bunx prisma migrate diff --from-url <the clone's URL> --to-schema-datamodel prisma/schema --script`,
   delete every `DROP` line, check that the rest only adds, and apply it. Count the pages per namespace; expect about 4,779
   articles. Keep the clone for reruns.
2. **Start a dev server on a clean worktree.** `git worktree add --detach ../ixstats-proof HEAD`, give it the local-only
   files a worktree needs, and check that `git status --porcelain` lists nothing under the WikiOS paths (below). Start the
   dev server there on port 3200 with `DATABASE_URL` pointing at `ixstats_proof` and `SKIP_DB_PUSH=1`,
   `SKIP_MEDIAWIKI_SYNC=true`, an empty `WIKIOS_MEDIAWIKI_BOT_USER` and `WIKIOS_MEDIAWIKI_BOT_TOKEN`,
   `WIKIOS_V1_ENABLED`, `WIKIOS_MEDIAWIKI_INTERNAL_URL` and `DISCORD_BOT_TOKEN` unset, and
   `NODE_OPTIONS=--max-old-space-size=4096`. Wait until `http://localhost:3200/wiki/Main_Page` answers 200. Run no
   typecheck or other dev server meanwhile.
3. **Run the proof** in the worktree, with `DATABASE_URL` naming `ixstats_proof`:
   `bun scripts/audit/wikios-proof.ts run --profile local --wikios http://localhost:3200`. It takes about an hour, almost
   all of it parity's 2-second pace against classic.
4. **Read `summary.md`** in the run directory. If a round-trip check fails or parity misses a floor, stop: leave the
   thresholds alone and take the lowest pages, their differences and the templates table to the owner. A harness that
   breaks (a request kind failing every time, say) is fixed in its `scripts/` file and the run repeats.
5. **Ratchet and re-gate.** Raise the thresholds as the ratchet rule allows, then
   `bun scripts/audit/wikios-proof.ts gate --profile local --roundtrip <dir>/roundtrip.json --parity <dir>/parity.json --bench <dir>/bench.json --out-dir <dir>/regated`.
   It must pass with `dirty: false`.
6. **Commit the proof.** Copy `<dir>/regated/summary.md` here as `<date>-local.md` and `<dir>/regated/summary.json` as
   `latest.json`, and commit them with the thresholds file. Stop the dev server by its PID and remove the worktree.

## How `latest.json` gates deploys

`scripts/deploy-production.sh` runs `bun scripts/audit/wikios-proof.ts predeploy` after `db:generate` and before the
database backup, so a refusal changes no data. It does not undo what the deploy did before it: the checkout is already
reset to the new release, the previous build removed (`bun run clean`), and the release's dependencies installed and
its Prisma client generated. With `.next` removed the running IxStates is effectively down until a deploy builds
again, so a refusal is recovered at once: a deploy with `WIKIOS_PROOF_OVERRIDE=1` in an expected override case, or a
rollback to the previous release (runbook step 2, "If the deploy refuses"). It takes the `wikios-proof` job lease (so the weekly proof never runs mid-deploy), reads
only, and refuses when:

- there is no `latest.json`, or it measured uncommitted WikiOS changes (`dirty`);
- its checks did not all pass (the result is recomputed from the checks, never read from the flag);
- it is a `recurring` run, or has no parity check;
- its tree key differs from this commit's: the key is a hash of `git ls-tree -r HEAD` over the WikiOS paths, so any
  change to them needs a new proof;
- the new code's full round trip of the production corpus fails a round-trip check: one changed byte, one page the
  serializer could not finish, one error, or fewer pages than the floor.

An error after it took the lease (an unwritable `WIKIOS_PROOF_DIR`, say) is a failed `predeploy.error` check like any
other, so it refuses and gives the lease back. `WIKIOS_PROOF_OVERRIDE=1` deploys anyway and prints each failure as
overridden. After the PM2 reload the deploy runs
`deployed`, which releases the lease; a deploy that dies on the way leaves the lease to expire in 2 hours.

**When to rerun the local proof:** after any committed change under the WikiOS paths (`WIKIOS_PROOF_PATHS` in
`scripts/lib/wikios-proof-gate.ts`): `src/lib/wiki-os`, `src/components/wiki-os`, `src/server/api/routers/wikios`,
`src/app/(wiki-os)`, `src/app/w`, `src/app/api/wiki`, `src/app/api/mediawiki`, `src/lib/utils/sanitize-html.ts`,
`src/lib/utils/scope-template-styles.ts`, `scripts/ops/mediawiki` and `prisma/schema/wiki.prisma`; the modules outside
those that the render, sanitize, serialize and view-bundle code imports and that change what it outputs
(`src/lib/utils/sanitize-sister-html.ts` and the `src/lib/thinkpages-forum/strip-positioning.ts` it runs,
`src/lib/thinkpages-forum/forum-quote.ts` and the `src/lib/thinkpages-forum/post-html.ts` it reads post ids with,
`src/lib/base-path.ts` with `scripts/setup/base-path.cjs` and the `scripts/setup/postcss-base-path-urls.cjs` stylesheet pass that follows it, `src/server/shared/wiki-placeholders.ts` and the `src/lib/utils/format-utils.ts` and
`src/lib/realms/realm-ids.ts` it formats and resolves with, `src/server/shared/ixstats-template-provider.ts`); and `bun.lock`, since DOMPurify, jsdom and the parsers are
dependencies. A new import of that kind belongs in the list too. Tests and the harness scripts are left out on purpose.

## Where the reports live

- **Local runs:** `.bench-out/proof/<yyyymmdd-HHMM>-<profile>/` (gitignored): the corpus titles, the bench pages, each
  harness's report and log, `summary.json` and `summary.md`.
- **Server runs:** under `WIKIOS_PROOF_DIR` (`/ixwiki/private/logs/wikios-proof` on the server; without it,
  `.bench-out/proof` in the checkout). The server profiles keep the newest 12 runs, and `predeploy` keeps its newest 12
  round-trip reports there as `predeploy-<stamp>.json`.
- **Committed, here:** this README, one dated summary per proof that proves a release (`<date>-<profile>.md`), and
  `latest.json`, the summary the deploy checks.
