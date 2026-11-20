# Lore groundwork: canon tiers, a complete link graph, why-chains

Status: design for approval. Date 2026-11-20. Phase 0 of the AI-assisted lore programme.

## Intent

The owner wants AI to make lore and worldbuilding on IxWiki better without writing any of it. The AI's jobs will be to read, remember, connect, question and check; every word of lore stays human. The community decides first: an IxWiki Request for Comment (RFC) on the principles runs before anything AI-facing ships.

This document covers only what can be built before the RFC closes: the non-AI foundation that every later AI feature reads. There are three parts and one community document:

1. a link graph that covers the whole corpus, redirects included;
2. canon tiers as data, with "the owner sets, a steward ratifies";
3. why-chains: the path from a nation's main page to any page, shown to readers and writers;
4. the RFC draft the owner posts.

### Grounding

**IxWiki:Lore Theory** is the community's own theory. It defines good lore as lore that answers "why do I need to know this to understand this world?". Every page sits in a chain: world → nation → culture → tradition → object. Main pages are hubs, load-bearing pages are spokes, tertiary pages are the wheel. A page with no foundation is "a mountaintop with no mountain".

The 2026-11-20 audit of the mirror (`ixstats_proof`, synced 2026-10-06) measured:

- **Corpus:** 4,771 content pages.
- **Orphans:** 1,100 pages nothing links to.
- **Weak hubs:** 64 of 207 country main pages have fewer than 5 inbound links; 30 have none.
- **Canon limbo:** 771 pages carry `{{WIP}}`, whose banner says they "may not be canonical". There is no machine-readable canon status; "Canonical Article" is tagged for deletion and Common Core is itself WIP.
- **Link coverage:** `wiki_links` holds about 35k of the about 204k links in the wikitext. 3,880 pages with links have no rows.
- **Redirects:** the mirror holds none.

## Principles (owner rulings, binding on every phase)

- AI never writes lore. Answers about the world are verbatim quotes plus links, never a synthesized summary.
- Contradiction checks cover hard facts only: dates, offices held, borders, deaths, treaty parties. Interpretation is never flagged.
- Flags are public Margin pins, on any page at any tier. Only the checker raises them; people never do. That leaves no lever for one nation to aim at another.
- One background index reads every save from classic MediaWiki and from WikiOS. It surfaces results only where people look: the WikiOS editor margin and reader paths. There is no Lore-tab dashboard and no Discord surface.
- Models are hosted with no retention (the existing `src/lib/llm/chat.ts` approach).
- The owner's caphiria- and zaclaria-lore-check skills are prior art for the checker.

## Goals

- Every published page's links and redirects are in the graph, from MediaWiki's own parse.
- Every page has an effective canon tier, and the system can show who set it and whether it is in force or pending.
- Any page can show its why-chain, or say plainly that it has none.
- The owner has a repeatable measure of the success metrics: orphans, hub inbound links, tier counts and link coverage.
- The owner has an RFC text ready to post.

## Non-goals (this phase)

- Any LLM call, embeddings, the background claim index, the contradiction checker, margin echoes, Socratic questions, the collision finder, the Read-Idea librarian and residue check. All of these come after the RFC, each with its own design.
- Changing Lorewards.
- Any change to classic ixwiki.com beyond what normal template edits already do.

## Anti-goals

- Generated text anywhere in a page, in an edit summary, or in a template the system adds.
- A second canon source of truth that drifts from the templates people already use.
- Making 771 WIP pages "pending" overnight, or any first run that changes what a page's banner says.
- Touching production. The owner deploys; production steps go in a runbook.

## Constraints

- These project rules apply:
  - `bun` only; no builds; typechecks only through the `typecheck:*` scripts;
  - import direction UI → routers → modules → shared;
  - Facet UI rules (no eyebrows, no uppercase labels, iron-gall ink primary);
  - the `useState` ratchet;
  - the React Compiler conventions.
- The link graph is MediaWiki's (`link-graph-service.ts` stores what `action=parse` reports). Rendering fills it; the graph must never be built from wikitext with a regex.
- WikiOS editing is not live in production, and classic MediaWiki stays the public, editable wiki. Tier changes therefore have to work from classic edits.
- The repo is public: no credentials or infrastructure details in the RFC text or PRs.

## Approaches considered

| | Where the tier lives | Trade-off |
|---|---|---|
| A | Templates only (`{{WIP}}`, `{{NonCanon}}`, …) | Works on both wikis, but anyone can retag anyone's page; "owner sets" is unenforced. |
| B | A WikiOS table managed in a UI | Clean permissions and audit, but a second source of truth that drifts from the 771 existing tags, and classic writers can't set tiers. |
| **C (picked)** | Templates are the input; a small table records who set each tier, whether it is in force, and steward ratification | A's compatibility with B's rule, at the cost of one small table and an ownership check. |

The owner picked C.

## Design

### 1. Link graph completeness

- **Backfill.** Run a one-off render backfill of every published page (all namespaces that hold links) through the existing `renderArticle` path. The parse result fills `wiki_links`, templates and file use. Throttle it the way `renderStaleBatch` already does; the 8 GB server sets the ceiling.
- **Keep it current.** The `wiki-render-stale` cron keeps pages fresh after the backfill; confirm it re-renders on every new revision from either wiki.
- **Redirects.** `scripts/sync-ixwiki-full.ts` filters `page_is_redirect = 0`, so the mirror holds no redirects. Ingest redirects into `wiki_articles` (`redirectTargetSlug` and `redirectTargetFragment` already exist). Check whether the `wiki-recentchanges` auto-sync also drops them, and fix that too.
- **Link resolution.** A link to a redirect resolves to the redirect's target for every graph read in this design.
- **Done when:** every published page whose wikitext has a `[[` link has `wiki_links` rows, and the red-link count no longer includes titles that are redirects on classic.

### 2. Canon tiers

**Tiers, highest first:** Common Core, Canon, Draft, Future, Non-canon.

**Scope.** IxWiki pages only (`source = 'ixwiki'`). Hubs and owners come from the default world (Ixnay) countries only; realm nations never match IxWiki categories.

**Declared tier from markers written in the page's own wikitext**: its own top-level template calls, resolved through template redirects, and its own category links, read with the existing WikiOS wikitext parser. Templates nested inside other templates don't count. As a result, a page's tier changes only when that page gets a new revision, so every change has an author. Editing or redefining `Template:NonCanon`, or a re-render after a renderer upgrade, never changes a tier.

| On the page | Declared tier |
|---|---|
| In `Category:Common Core` | Common Core |
| `{{NonCanon}}` or `{{AbandonLore}}` | Non-canon |
| `{{FutureLore}}` | Future |
| `{{WIP}}`, or a nation WIP variant (`{{Urcea WIP}}`, `{{Kir WIP}}`, `{{Caphiria WIP}}`, …) | Draft |
| None of these | Canon |

When a page has several markers, the lowest tier wins; for example, WIP plus NonCanon means Non-canon. Common Core is the exception (owner ruling). Once a steward ratifies it, the page is Common Core whatever other markers it carries, and a `{{WIP}}` banner on it means "still being expanded", not "not binding". 22 of the 58 Common Core pages carry WIP today. Until ratification, Common Core is ignored and the other markers decide. The marker list is data in `src/lib/lore/`, so a new WIP variant is a one-line change.

**Ownership:**
- *A page's nations:* the countries whose name matches a category on the page, plus the country whose `Country.wikiPageTitle` is the page itself.
- *The editor:* the revision's MediaWiki author, mapped through an approved `wiki_name_claims` row to a `User`; WikiOS saves already know the user.
- *Owner:* `User.countryId` equals one of the page's nations, or the user is on that nation's `country_lore_authors` team.
- *Steward:* a new permission in the existing role system, granted by admins (`lore.steward`; the builder picks the exact RBAC wiring).

**Effective tier.** A record per page (`lore_page_tiers`) holds the declared tier, the effective tier, the status (`in_force` or `pending`), the revision and user that declared it, and the ratifier and time for Common Core. An event row (`lore_tier_events`) records every change for audit. When a new revision changes the declared tier:

A page's nations, for this check, are read from the revision before the edit. Adding your own nation's category in the same edit that changes the tier gives you no rights over that change.

| Who made the edit | Result |
|---|---|
| A steward | The new tier takes effect. |
| The owner of the page's only nation | The new tier takes effect. |
| An owner of one nation on a page shared by several | Pending until every other nation on the page has an owner accept it, or a steward rules (owner ruling). Any rejection sends it to stewards. No nation can change shared lore on its own. |
| Anyone else, or an editor who can't be mapped to a user | The new tier is pending; the effective tier stays as it was. |
| A page with no nation (world topics) | Only a steward's change takes effect; anyone else's is pending. |
| Common Core declared | Pending until a steward ratifies; until then the other markers decide. A steward removing it takes effect at once. |

Pending changes rejected by an owner form the stewards' queue, which is how cross-nation conflicts reach them.

- **Who sees pending changes:** the page's owners and stewards, in WikiOS: a line in the editor margin and a list on the WikiOS page tools. Owners or stewards can accept or reject; a rejection doesn't edit the page, the declared marker just stays not in force. Classic writers see this only in WikiOS (owner ruling).
- **First run.** Every page's current markers are taken as in force, grandfathered, with no pending rows; the banners people see don't change. The 58 Common Core pages are the exception: they start as pending ratification and stay Canon until a steward ratifies, which gives stewards a ready queue.
- **Hooks.** The tier is recomputed from the stored parse metadata whenever a page is re-rendered. Classic edits arrive through auto-sync and then a render; WikiOS saves render too. A single entry point keeps both wikis on one path.

### 3. Why-chains

**Prose links only (owner ruling).** Only links written in a page's own wikitext count for why-chains and the orphan metric. Links that navboxes and other templates add are still stored and used everywhere else (backlinks, red links), but they aren't steps in a chain. Each `wiki_links` row therefore records whether the link is prose: a link is prose when the page's own wikitext contains it, determined with the existing wikitext parser. The audit's orphan count (1,100) came from links in wikitext, so the before-and-after numbers are comparable. Chains may pass through pages of any tier and run through the main namespace only.

**The path.** The why-chain of a page is the shortest path along blue prose links, with redirects resolved, from a nation hub (a page that is some `Country.wikiPageTitle`) to the page, following outbound links: hub → Culture of X → Festival → the page. That direction is Lore Theory's chain: the hub explains the spoke, and the spoke explains the wheel.

- **Search:** a recursive query capped at depth 6, preferring hubs among the page's own nations, then any hub.
- **No path** within the cap means an orphan from the hub's point of view. The page shows "Not yet connected to a nation's main page" and names the page's nations when it has any.
- **Ties:** the path whose hub is one of the page's nations wins, then the shortest, then alphabetical.

**Where it shows:**
- *Reader:* on WikiOS article pages, one quiet path line under the title (Urcea › Culture of Urcea › Saffron Festival), each step a link. Nothing shows on hub pages themselves. A non-Canon page also shows a small tier badge next to it (Draft, Future, Non-canon; Common Core gets its own badge once ratified).
- *Editor:* the WikiOS editor margin shows the same chain, plus the "not connected" notice with the page's nations, so the writer knows which hub or spoke to link from.

Results are cached per page and invalidated when the graph around them changes. The builder picks the mechanism; a cheap recompute on render of the page and its hub is acceptable.

### 4. Corpus health measure

A script under `scripts/audit/` prints the success metrics from the database:
- link coverage;
- orphans;
- hubs with fewer than 5 inbound links;
- tier counts and pending count;
- red-link titles by number of linking pages.

The owner runs it before and after each phase. A dashboard isn't wanted (owner ruling).

### 5. RFC draft

`docs/systems/lore-ai-rfc-draft.md` is written for the IxWiki community, not engineers. It should:
- state the principles above in plain words;
- show what the AI would and would not do, with examples drawn from the audit (a hard-fact contradiction, an echo of "Saint's War" across 45 pages, a why-chain);
- explain how tiers work and that existing banners keep working;
- say where lore goes (hosted, no retention, never used for training);
- ask the community explicit questions, including how Lorewards should treat AI-assisted pages.

The owner posts it as `IxWiki:Requests for comment/…`.

## Decided by the owner

- AI never writes lore; the RFC comes first; only non-AI parts are built before it.
- Canon is tiered; owners set their tier and stewards ratify Common Core and rule on cross-nation conflicts.
- Approach C for tiers.
- Surfaces: the WikiOS editor margin and reader paths.
- Classic writers are served through WikiOS only.
- A tier change on a page shared by several nations needs every nation to accept it, or a steward to rule.
- Why-chains use prose links only.
- A ratified Common Core page stays Common Core even when it carries WIP.

## Calls made in this document (owner to check)

- IxWiki pages and default-world countries only.
- Markers count only when written in the page's own wikitext, so only page revisions change tiers.
- Ownership is read from the revision before the edit.
- No marker means Canon. A new `{{Canon}}` template isn't needed.
- Lowest tier wins when markers conflict.
- Grandfather existing markers on the first run; Common Core starts pending ratification.
- A page's nations come from its categories and `Country.wikiPageTitle`.
- On pages with no nation, only stewards' changes take effect.
- An edit by an unmapped editor is pending.
- Why-chains follow outbound links from the hub, capped at depth 6.
- A health script instead of a dashboard.
- The RFC draft lives in `docs/systems/`.

## Left to the builder

- The exact RBAC wiring for `lore.steward`.
- The Prisma schema file and the names of the two tables.
- Backfill throttling and batch size.
- Caching and invalidation for why-chains.
- The UI composition within Facet (Margin conventions, badge component).
- The test layout. Tier resolution and why-chain path selection are pure logic in `src/lib/lore/` with unit tests.
