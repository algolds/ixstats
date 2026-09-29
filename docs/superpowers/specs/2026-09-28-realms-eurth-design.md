# Realms — Eurth, the first outside realm (design)

**Date:** 2026-09-28 · **Branch:** `realms-foundation` · **Builds on:** Phase 1 (`2026-09-27-realms-foundation-design.md`)
**Product model:** `docs/architecture/realms-framework-spec.md` — decisions 1–25 are binding.
**Owner's instruction:** "finish all plans, make realms valid and green-lit, use https://eurth.org/ as the first realm."

## What Eurth is (verified 2026-09-28)

- eurth.org is a Discourse forum ("realistic geofiction and political simulation, loosely based on NationStates").
- Its lore is on **iiwiki** under `Category:Eurth`: **2,637 pages**, 212 files, 25 subcategories. Every subcategory name
  contains "Eurth". The subcategories include `Category:Eurth` itself (a cycle), plus Eurth redirects, templates, users
  and stubs. The portal is `Portal:Eurth`.
- Nation pages are ordinary iiwiki articles whose lead section uses `{{Infobox country}}` or `{{Infobox former country}}`
  (e.g. Gallambria).
- The dev iiwiki proxy (`getFullIiwikiApiUrl()`) supports `list=categorymembers`, `prop=categories` and
  `prop=revisions&rvprop=content`. It strips `list=embeddedin`, so detection must not depend on it.
- The map is equirectangular. No flat-colour political PNG is on hand, so the map is **optional** for launch.

## Decisions for this slice (rulings; the owner pre-authorised "finish everything")

| # | Decision | Why |
|---|---|---|
| E-a | Eurth's lore is **indexed, not copied**: `RealmPage(realmId, wikiSource "iiwiki", title, kind lore\|nation)`. WikiOS renders the pages live from iiwiki, as it already does for every iiwiki page. | WikiOS never stores iiwiki content; a new `source="eurth"` breaks its zod enums, `WIKIS` proxy config and image resolution. The index satisfies decision 7's intent: one import, realm-tagged, and it feeds the portal and claims. Copying content is a later project if iiwiki ever goes away. |
| E-b | The page cap for the one-time import is **5,000** (decision 7 said 2,000). | Eurth alone has 2,637 pages. |
| E-c | Only subcategories whose title contains the realm keyword are followed; redirects, templates, users and stubs categories and the root itself are never followed. | This is decision 7's "no wiki-global categories" rule, made concrete for iiwiki. |
| E-d | A nation is a crawled page whose lead section uses `Infobox country` or `Infobox former country` (content fetched in batches of 50). | It is the only proxy-safe signal, and it is how iiwiki marks nations. |
| E-e | Import runs as an owner-run script (`scripts/realms/import-realm-lore.ts`): a dry run is the preview, `--apply` writes. | Around 55 wiki requests is too long for a web request. Scripts are how this repo already runs imports. |
| E-f | Claiming a nation page, once approved, **creates the Country** in the realm with baseline data (the same baseline `users.createCountry` uses) and assigns it. The owner refines it in MyCountry and the builder. | Decision 8 says a row exists only on claim. A pre-filled builder hand-off is follow-up work. |
| E-g | A colliding country slug gets `-<realm slug>` (decision 5). | Decision 5. |
| E-h | **Realm context** (decision 4): the viewer's realm is `?realm=<slug>` when given, else the active nation's realm, else IxWorld. Every query that lists **across** countries or map features for display filters by it. Crons, the simulation, per-id lookups and admin tools do not filter. | This is the rule in the product model. Without it, Eurth nations and map features would appear in IxWorld's lists and map. |
| E-i | `MapLayer`'s unique key becomes `(realmId, layerType, featureId)`. | Otherwise two realms' feature ids collide on upsert. |
| E-j | Eurth is created in `/admin/realms` (a new "New realm" form), not by seed. Founder `ownerId = "system"` until an Eurth admin has an IxStats account. The runbook gives exact values. | Decision 6 (admin approval) with the admin as applicant. There is no hard-coded realm. |

## Out of scope (still later work)

The public founding application form · the realm calendar label (`yearOffset`) · pre-filling the builder from a claimed page · copying content into WikiOS · a per-realm ThinkPages feed and global-feed setting · founder moderation, removals, succession and archiving · the passport switcher and nav chip (Phase 3–4).

## Acceptance ("green-lit")

1. Typecheck `server`, `trpc`, `ui` and `db` report **0 errors**, the same as the baseline.
2. All new and touched Jest suites pass. The full `src/tests/server`, `src/tests/lib` and `src/tests/components` runs show no new failures against the base.
3. `bun run lint` shows no new warnings in touched files, and `audit:idor` is clean.
4. The whole-branch review is clean, or every finding is fixed or parked with a ruling.
5. The runbook `docs/realms/eurth-onboarding.md` takes an admin from nothing to "Eurth players can claim nations at `/r/eurth`".
