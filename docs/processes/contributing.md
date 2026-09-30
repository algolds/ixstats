# Contributing Guide

**Last updated:** September 2026

This guide outlines expectations for contributing to IxStats. Use it alongside the architectural and system docs when planning work.

## Branches

Work flows up through three long-lived branches, always by merge pull request (never force-push `development` or
`master`):

| Branch | Purpose | Who works here | Stability |
|---|---|---|---|
| `rose-garden` | Nightly build: experiments and fast iteration. Dependabot targets it. | Maintainer | May break |
| `development` | Stable but still experimental base, promoted from `rose-garden` when CI is green. | Junior devs branch from and PR into it | Should always build and pass CI |
| `master` | Production. Promoted from `development` at a release; `scripts/deploy-production.sh` deploys it. | Releases only | Stable |

- **Promote** `rose-garden` → `development` with a merge PR once CI is green on `rose-garden` and a quick smoke test
  passes; promote `development` → `master` for a release, then deploy (see
  [deployment-checklist.md](../operations/deployment-checklist.md)).
- **Back-merge** `development` into `rose-garden` after junior work lands there, so the nightly branch doesn't drift.
- **Hotfixes** for production branch from `master`, merge into `master`, then back-merge down to `development` and
  `rose-garden`.

## Workflow
1. Create a feature branch with a descriptive name: from `rose-garden` for nightly/experimental work, or from
   `development` for work that should land in the stable-experimental branch (junior devs)
2. Install dependencies and prepare the database (`bun install`, `bun run db:setup`)
3. Implement changes with accompanying tests and documentation updates
4. Run quality gates: `bun run test`, `bun run typecheck`, `bun run audit:arch`, `bun run lint:strict`, `bun run docs:check` (the same gates CI runs in `.github/workflows/ci.yml`)
5. Submit a pull request referencing the relevant documentation or help articles

## Code Standards
- TypeScript everywhere; avoid `any` unless unavoidable and document why
- Keep domain logic in services or routers, UI logic in components
- Use shared design primitives (`src/components/ui`) to maintain visual consistency
- Update or add React Query invalidation when mutating data
- Prefer composable hooks for complex state or derived calculations

## Documentation Expectations
- Update the relevant Markdown guide in `docs/` and `/help`
- Keep feature-level READMEs (e.g., `src/app/mycountry/README.md`) aligned with code changes
- Note breaking changes or migrations in the pull request

## Tests & Verification
- Add or update Jest tests for routers/services touched
- Include manual testing notes for features lacking automation
- There is no browser E2E suite (Playwright is not installed); document manual verification for UX-critical paths

## Review Checklist
- Does the change respect rate limiting and auth boundaries?
- Are environment variables documented if introduced?
- Are WebSocket events handled gracefully (if applicable)?
- Has the help center been updated for user-facing changes?

## Release Guidance
- Record releases in the root `CHANGELOG.md`; version numbers come from `src/lib/buildVersion.ts`
- Run deployment checklist from `docs/operations/deployment.md`
- Archive legacy docs under `docs/archive/<date>` when retiring features (`docs/archive/` is git-ignored and kept locally)

Maintainers should revise this guide when workflow expectations change or new tooling is adopted.
