# Documentation history

**Last updated:** 2026-10-05

Retired documents that are still worth keeping: finished audits, superseded specs and plans, and docs that describe
deleted code. They are tracked in git, so links to them keep working, but **nothing here describes the current
system**. Start from the [documentation hub](../README.md) for that.

**Policy** ([contributing.md](../processes/contributing.md#archiving-documentation)): when a doc is finished,
superseded or obsolete, `git mv` it here under the same sub-path it had in `docs/`, add a one-line "Retired" note
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
| [systems/wikios/wikios-independence-2b-3.md](systems/wikios/wikios-independence-2b-3.md) | Stage 2b shipped; Stage 3 lives in [wikios-stage3-config-plan.md](../systems/wikios/wikios-stage3-config-plan.md) |

## Merged into another doc

| Document | Now |
|---|---|
| [systems/community-feedback-audit.md](systems/community-feedback-audit.md) | A section of [research/community-feedback-analysis.md](../research/community-feedback-analysis.md#how-the-feedback-was-addressed) |
| [operations/deployment-checklist.md](operations/deployment-checklist.md) | Its useful checks are in [release-guide.md](../operations/release-guide.md) Part A. A pointer stays at the old path for `docs:check` |

Also merged on 2026-10-05, without a history copy: `systems/wikios.md` is now a pointer to
[systems/wikios/WIKIOS.md](../systems/wikios/WIKIOS.md), which took its unique facts, and `realms/eurth-onboarding.md`
moved to [systems/realms-eurth-onboarding.md](../systems/realms-eurth-onboarding.md).

## Due to retire

- [operations/deploy-rose-garden-2026-09.md](../operations/deploy-rose-garden-2026-09.md): after the 1.4 release.
- [roadmap/ACTION_PLAN_2026-10-05.md](../roadmap/ACTION_PLAN_2026-10-05.md): once its remaining owner and ops actions
  are done.
- Implemented specs listed under PF§7 in the [backlog](../roadmap/backlog.md#pf7-documentation-gaps).
