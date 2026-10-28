# Documentation history

**Last updated:** 2026-10-27

Retired documents that are still worth keeping: finished audits, superseded specs and plans, and docs that describe
deleted code. They are tracked in git, so links to them keep working, but **nothing here describes the current
system**. Start from the [documentation hub](../README.md) for that.

**Policy** ([contributing.md](../processes/contributing.md#archiving-documentation)): when a doc is finished,
superseded or obsolete, `git mv` it here under the same sub-path it had in `docs/` (specs from any folder go to `history/specs/`, executed plans to
`history/plans/`), add a one-line "Retired" note
under its title, fix every link to it, and list it below. `docs/archive/` and `plans/` are local-only maintainer
folders (git-ignored); never link them from tracked docs.

## Roadmap and audits

| Document | Retired because |
|---|---|
| [roadmap/pending-features.md](roadmap/pending-features.md) | Doc-based backlog of 2026-09-29. Open items moved to [backlog.md](../roadmap/backlog.md) (PF§1–PF§7) |
| [roadmap/code-audit-2026-09-30.md](roadmap/code-audit-2026-09-30.md) | Code audit of 2026-09-30. Open IDs moved to the backlog; this copy keeps the evidence, the dead-schema list and the cron readiness table |
| [roadmap/platform-audit/README.md](roadmap/platform-audit/README.md) | Platform audit of 2026-09-30 and its status page. Open items moved to the backlog (PA) |
| Platform audit area reports: [atlas](roadmap/platform-audit/atlas.md), [mycountry](roadmap/platform-audit/mycountry.md), [vault-identity](roadmap/platform-audit/vault-identity.md), [wikios-onoma](roadmap/platform-audit/wikios-onoma.md), [social-core](roadmap/platform-audit/social-core.md), [ponytail](roadmap/platform-audit/ponytail.md) | Snapshots the platform audit was built from |
| [audits/REFACTOR_PLAN_2026-06.md](audits/REFACTOR_PLAN_2026-06.md) | June 2026 refactor plan; every item resolved |
| [audits/test-suite-audit-and-justification.md](audits/test-suite-audit-and-justification.md) | August 2026 test-suite inventory; its removals are done |

## Specs, plans and system notes

| Document | Retired because |
|---|---|
| [specs/2026-09-30-facet-3-design-system.md](specs/2026-09-30-facet-3-design-system.md) | Facet 3 spec, superseded by Facet 4 |
| [reference/user-profile-utils.md](reference/user-profile-utils.md) | Its module was deleted in June 2026 |
| [systems/map-editor-improvements-overview.md](systems/map-editor-improvements-overview.md) | June–August map editor plans, all shipped or superseded |
| [systems/statecraft/mycountry-vision-audit.md](systems/statecraft/mycountry-vision-audit.md) | June 2026 snapshot of the MyCountry vision against the build |
| [systems/wikios/wikios-longevity-workflow.md](systems/wikios/wikios-longevity-workflow.md) | WikiOS longevity round complete; Workstream C is in the backlog |
| [systems/wikios/wikios-independence-2b-3.md](systems/wikios/wikios-independence-2b-3.md) | Stage 2b shipped; Stage 3 lives in [wikios-stage3-config-plan.md](systems/wikios/wikios-stage3-config-plan.md) |
| [systems/scheduled-changes.md](systems/scheduled-changes.md) | Its pipeline was deleted on 2026-10-06 (D11) |
| [operations/forum-xenforo-import-runbook.md](operations/forum-xenforo-import-runbook.md) | XenForo forum go-live runbook; its export and import tooling was deleted on 2026-10-21 (owner ruling) |

## Merged into another doc

| Document | Now |
|---|---|
| [systems/community-feedback-audit.md](systems/community-feedback-audit.md) | A section of [research/community-feedback-analysis.md](../research/community-feedback-analysis.md#how-the-feedback-was-addressed) |
| [operations/deployment-checklist.md](operations/deployment-checklist.md) | Its useful checks are in [release-guide.md](../operations/release-guide.md) Part A |

Also merged on 2026-10-05, without a history copy: `systems/wikios.md` became a pointer to
[systems/wikios/WIKIOS.md](../systems/wikios/WIKIOS.md) (retired as a stub on 2026-10-27), and `realms/eurth-onboarding.md`
moved to `systems/realms-eurth-onboarding.md` and, on 2026-10-27, to [operations/realms-eurth-onboarding.md](../operations/realms-eurth-onboarding.md).

## Retired 2026-10-27 (docs audit after release 1.5)

Former path is relative to `docs/`.

### Executed runbooks (release 1.5, 2026-10-26/27)

| Document | Former path | Retired because |
|---|---|---|
| [operations/release-1.5-lobster-crosby.md](operations/release-1.5-lobster-crosby.md) | `operations/release-guide.md` (Part B) | The 1.5 one-off release steps; ran 2026-10-26/27, with the rehearsal deviations |
| [operations/cards-refresh-runbooks-1.5.md](operations/cards-refresh-runbooks-1.5.md) | `systems/cards.md` (deploy runbook sections) | Cards refresh phase 2–4 and categories runbooks; ran in 1.5 |
| [operations/ixnayid-lorewards-runbooks-1.5.md](operations/ixnayid-lorewards-runbooks-1.5.md) | `systems/ixnayid-passport.md` (deploy runbook sections) | IxnayID identity and Lorewards runbooks; ran in 1.5 |
| [operations/deploy-mycountry-2026-10.md](operations/deploy-mycountry-2026-10.md) | `operations/deploy-mycountry-2026-10.md` | Executed on production 2026-10-26/27 (release 1.5) |
| [operations/deploy-realm-time-2026-10.md](operations/deploy-realm-time-2026-10.md) | `operations/deploy-realm-time-2026-10.md` | Executed on production 2026-10-26/27 (release 1.5) |
| [operations/deploy-rose-garden-2026-09.md](operations/deploy-rose-garden-2026-09.md) | `operations/deploy-rose-garden-2026-09.md` | Executed on production 2026-10-26/27 (release 1.5) |
| [operations/drop-unused-models.md](operations/drop-unused-models.md) | `operations/drop-unused-models.md` | Executed on production 2026-10-26/27 (release 1.5) |
| [operations/huggingface-spaces-guide.md](operations/huggingface-spaces-guide.md) | `operations/huggingface-spaces-guide.md` | Proposal never wired into the app |
| [operations/wikios-v1-cutover.md](operations/wikios-v1-cutover.md) | `operations/wikios-v1-cutover.md` | Executed on production 2026-10-26/27 (release 1.5) |

### Specs

| Document | Former path | Retired because |
|---|---|---|
| [specs/2026-06-12-myleague-v1-prd.md](specs/2026-06-12-myleague-v1-prd.md) | `specs/2026-06-12-myleague-v1-prd.md` | Superseded; MyLeague is built (`src/app/myleague`) |
| [specs/2026-08-13-ixcards-lore-first-rebuild.md](specs/2026-08-13-ixcards-lore-first-rebuild.md) | `specs/2026-08-13-ixcards-lore-first-rebuild.md` | Phases 1–5 built; open work continues in the cards refresh spec |
| [specs/2026-09-08-builder-unified-companion-guide-design.md](specs/2026-09-08-builder-unified-companion-guide-design.md) | `specs/2026-09-08-builder-unified-companion-guide-design.md` | Superseded by the country builder redesign |
| [specs/2026-09-12-route-travel-time-design.md](specs/2026-09-12-route-travel-time-design.md) | `specs/2026-09-12-route-travel-time-design.md` | Implemented (`src/lib/economy/travel-time.ts`) |
| [specs/2026-09-27-realms-foundation-design.md](specs/2026-09-27-realms-foundation-design.md) | `specs/2026-09-27-realms-foundation-design.md` | Implemented (Realms phase 1) |
| [specs/2026-09-28-realms-eurth-design.md](specs/2026-09-28-realms-eurth-design.md) | `specs/2026-09-28-realms-eurth-design.md` | Implemented (Eurth realm) |
| [specs/2026-10-04-facet-4-sidebar-design.md](specs/2026-10-04-facet-4-sidebar-design.md) | `specs/2026-10-04-facet-4-sidebar-design.md` | Implemented |
| [specs/2026-10-05-realm-regions-design.md](specs/2026-10-05-realm-regions-design.md) | `specs/2026-10-05-realm-regions-design.md` | Implemented (`src/lib/realms/realm-region.ts`) |
| [specs/2026-10-07-action-linked-posts-design.md](specs/2026-10-07-action-linked-posts-design.md) | `superpowers/specs/2026-10-07-action-linked-posts-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-07-eurth-map-port.md](specs/2026-10-07-eurth-map-port.md) | `specs/2026-10-07-eurth-map-port.md` | Implemented; its IxWorld framing is obsolete |
| [specs/2026-10-07-forum-concept-a-lean-xenforo-design.md](specs/2026-10-07-forum-concept-a-lean-xenforo-design.md) | `superpowers/specs/2026-10-07-forum-concept-a-lean-xenforo-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-07-forum-concept-b-thinkpages-forum-design.md](specs/2026-10-07-forum-concept-b-thinkpages-forum-design.md) | `superpowers/specs/2026-10-07-forum-concept-b-thinkpages-forum-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-07-map-vector-tiles-design.md](specs/2026-10-07-map-vector-tiles-design.md) | `superpowers/specs/2026-10-07-map-vector-tiles-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-07-passport-showcase-design.md](specs/2026-10-07-passport-showcase-design.md) | `superpowers/specs/2026-10-07-passport-showcase-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-08-wikios-editing-toggle-design.md](specs/2026-10-08-wikios-editing-toggle-design.md) | `superpowers/specs/2026-10-08-wikios-editing-toggle-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-09-thinkpages-forum-foundation-design.md](specs/2026-10-09-thinkpages-forum-foundation-design.md) | `superpowers/specs/2026-10-09-thinkpages-forum-foundation-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-09-thinkpages-forum-native-concept.md](specs/2026-10-09-thinkpages-forum-native-concept.md) | `superpowers/specs/2026-10-09-thinkpages-forum-native-concept.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-10-thinkpages-forum-action-integration-design.md](specs/2026-10-10-thinkpages-forum-action-integration-design.md) | `superpowers/specs/2026-10-10-thinkpages-forum-action-integration-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-10-thinkpages-forum-integrations-design.md](specs/2026-10-10-thinkpages-forum-integrations-design.md) | `superpowers/specs/2026-10-10-thinkpages-forum-integrations-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-10-thinkpages-forum-reactions-design.md](specs/2026-10-10-thinkpages-forum-reactions-design.md) | `superpowers/specs/2026-10-10-thinkpages-forum-reactions-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-10-thinkpages-forum-realm-adverts-design.md](specs/2026-10-10-thinkpages-forum-realm-adverts-design.md) | `superpowers/specs/2026-10-10-thinkpages-forum-realm-adverts-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-10-thinkpages-forum-unread-notifications-design.md](specs/2026-10-10-thinkpages-forum-unread-notifications-design.md) | `superpowers/specs/2026-10-10-thinkpages-forum-unread-notifications-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-10-thinkpages-realm-board-design.md](specs/2026-10-10-thinkpages-realm-board-design.md) | `superpowers/specs/2026-10-10-thinkpages-realm-board-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-11-atlas-release-0-performance-design.md](specs/2026-10-11-atlas-release-0-performance-design.md) | `specs/2026-10-11-atlas-release-0-performance-design.md` | Implemented (`20261021120000_atlas_r0`) |
| [specs/2026-10-11-atlas-release-a-world-creation-design.md](specs/2026-10-11-atlas-release-a-world-creation-design.md) | `specs/2026-10-11-atlas-release-a-world-creation-design.md` | Implemented (`20261022120000_atlas_ra`) |
| [specs/2026-10-11-front-page-design.md](specs/2026-10-11-front-page-design.md) | `superpowers/specs/2026-10-11-front-page-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-11-thinkpages-forum-home-design.md](specs/2026-10-11-thinkpages-forum-home-design.md) | `superpowers/specs/2026-10-11-thinkpages-forum-home-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-12-atlas-studio-design.md](specs/2026-10-12-atlas-studio-design.md) | `specs/2026-10-12-atlas-studio-design.md` | Implemented (`20261023120000_atlas_studio`) |
| [specs/2026-10-14-realm-clocks-design.md](specs/2026-10-14-realm-clocks-design.md) | `superpowers/specs/2026-10-14-realm-clocks-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-14-vault-collectathon-hub-design.md](specs/2026-10-14-vault-collectathon-hub-design.md) | `specs/2026-10-14-vault-collectathon-hub-design.md` | Implemented (`20261024120000_vault_hub`) |
| [specs/2026-10-15-country-builder-editor-redesign-design.md](specs/2026-10-15-country-builder-editor-redesign-design.md) | `specs/2026-10-15-country-builder-editor-redesign-design.md` | Implemented (phases 0–5) |
| [specs/2026-10-15-thinkpages-forum-posts-design.md](specs/2026-10-15-thinkpages-forum-posts-design.md) | `superpowers/specs/2026-10-15-thinkpages-forum-posts-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-23-card-categories-design.md](specs/2026-10-23-card-categories-design.md) | `superpowers/specs/2026-10-23-card-categories-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-23-ixnayid-identity-and-lorewards-design.md](specs/2026-10-23-ixnayid-identity-and-lorewards-design.md) | `superpowers/specs/2026-10-23-ixnayid-identity-and-lorewards-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-23-realms-atlas-design.md](specs/2026-10-23-realms-atlas-design.md) | `superpowers/specs/2026-10-23-realms-atlas-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-24-country-page-passport-design.md](specs/2026-10-24-country-page-passport-design.md) | `superpowers/specs/2026-10-24-country-page-passport-design.md` | Implemented or superseded; shipped by release 1.5 |
| [specs/2026-10-24-wikios-launch-hardening-design.md](specs/2026-10-24-wikios-launch-hardening-design.md) | `superpowers/specs/2026-10-24-wikios-launch-hardening-design.md` | Implemented or superseded; shipped by release 1.5 |

### Plans

| Document | Former path | Retired because |
|---|---|---|
| [plans/2026-10-11-atlas-ship-plan.md](plans/2026-10-11-atlas-ship-plan.md) | `specs/2026-10-11-atlas-ship-plan.md` | Executed: Atlas R0, RA and Studio shipped |

### Point-in-time audits

| Document | Former path | Retired because |
|---|---|---|
| [audits/AUDIT_2026-06-13.md](audits/AUDIT_2026-06-13.md) | `audits/AUDIT_2026-06-13.md` | Point-in-time audit; open items are in the backlog |
| [audits/AUDIT_2026-06.md](audits/AUDIT_2026-06.md) | `audits/AUDIT_2026-06.md` | Point-in-time audit; open items are in the backlog |
| [audits/AUDIT_2026-09-23_bloat-slop.md](audits/AUDIT_2026-09-23_bloat-slop.md) | `audits/AUDIT_2026-09-23_bloat-slop.md` | Point-in-time audit; open items are in the backlog |
| [audits/FACET_STYLE_AUDIT_2026-09-30.md](audits/FACET_STYLE_AUDIT_2026-09-30.md) | `audits/FACET_STYLE_AUDIT_2026-09-30.md` | Point-in-time audit; open items are in the backlog |
| [audits/HEX_COLOUR_INVENTORY_2026-09-27.md](audits/HEX_COLOUR_INVENTORY_2026-09-27.md) | `audits/HEX_COLOUR_INVENTORY_2026-09-27.md` | Point-in-time audit; open items are in the backlog |

### Research

| Document | Former path | Retired because |
|---|---|---|
| [research/chatgpt-logs.md](research/chatgpt-logs.md) | `research/chatgpt-logs.md` | Raw transcript |
| [research/community-logs.md](research/community-logs.md) | `research/community-logs.md` | Raw Discord log (names community members) |
| [research/sports-llm-commentary.md](research/sports-llm-commentary.md) | `research/sports-llm-commentary.md` | Implemented (sports commentary; flag off) |

### Roadmap

| Document | Former path | Retired because |
|---|---|---|
| [roadmap/ACTION_PLAN_2026-10-05.md](roadmap/ACTION_PLAN_2026-10-05.md) | `roadmap/ACTION_PLAN_2026-10-05.md` | 1.4-era action plan; superseded by the post-1.5 roadmap and backlog |

### System notes

| Document | Former path | Retired because |
|---|---|---|
| [systems/intelligence.md](systems/intelligence.md) | `systems/intelligence.md` | Folded into [defense.md](../systems/defense.md#intelligence) |
| [systems/myleague-lore-integration.md](systems/myleague-lore-integration.md) | `systems/myleague-lore-integration.md` | Folded into [myleague.md](../systems/myleague.md#lore-fidelity) |
| [systems/wikios-pointer.md](systems/wikios-pointer.md) | `systems/wikios.md` | Pointer stub; the hub links [WIKIOS.md](../systems/wikios/WIKIOS.md) directly |
| [systems/myleague-top5-features.md](systems/myleague-top5-features.md) | `systems/myleague-top5-features.md` | June proposal, largely implemented |
| [systems/wikios/wikios-stage3-config-plan.md](systems/wikios/wikios-stage3-config-plan.md) | `systems/wikios/wikios-stage3-config-plan.md` | Superseded by the WikiOS v1 launch |

## Due to retire

- Specs still listed under PF§7 in the [backlog](../roadmap/backlog.md) once implemented.
- [specs/2026-10-06-exchange-economy-design.md](../specs/2026-10-06-exchange-economy-design.md) once VT-16 closes (code cites it).
