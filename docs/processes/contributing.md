# Contributing Guide

**Last updated:** 2026-10-05

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
  the [release guide](../operations/release-guide.md)).
- **Back-merge** `development` into `rose-garden` after junior work lands there, so the nightly branch doesn't drift.
- **Hotfixes** for production branch from `master`, merge into `master`, then back-merge down to `development` and
  `rose-garden`.

## Workflow
1. Create a feature branch with a descriptive name. **Contributors branch from `development` and open their PR
   against it** (decision D13); only the maintainer works on `rose-garden`.
2. Install dependencies and prepare an empty local database: `bun install`, start PostgreSQL + PostGIS and Redis
   with `docker compose -f docker-compose.dev.yml up -d`, then `bun run db:setup` (it runs `db:generate` and
   `db:bootstrap`). See [local-dev-setup.md](../operations/local-dev-setup.md#part-4--create-the-local-database).
3. Implement changes with accompanying tests and documentation updates
4. Run the gates CI runs (`.github/workflows/ci.yml`), all blocking unless noted:
   - `bun run test:ci` (Jest; files listed in `scripts/verification/test-quarantine.json` are skipped)
   - `bun run check:entrypoints`
   - `bun run typecheck` (runs `typecheck:ui`, `typecheck:server`, `typecheck:trpc`, `typecheck:db` and `typecheck:scripts`)
   - `bun run validate:script-targets` and `bun run check:script-imports`
   - `bun run docs:check`
   - `bun run audit:arch` and `bun run lint:strict` (`--max-warnings 2100`) run in CI too, but **non-blocking**;
     `audit:arch` fails today on known violations. Don't add new ones
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
- When a PR closes a roadmap ID, delete its row from [backlog.md](../roadmap/backlog.md), mark it done in
  [ROADMAP.md](../roadmap/ROADMAP.md), and update the system doc and [SYSTEM_STATUS.md](../systems/SYSTEM_STATUS.md)
- Link every new doc from the [documentation hub](../README.md)

## Archiving Documentation
- Retired docs (finished audits, superseded specs, docs for deleted code) move to the tracked
  [`docs/history/`](../history/README.md) folder with `git mv`, under the same sub-path they had in `docs/`
- Add a one-line "Retired" note under the title, fix every link to the old path, and list the doc in
  [docs/history/README.md](../history/README.md)
- `docs/archive/` and `plans/` are local-only maintainer folders (git-ignored): don't move tracked docs there and
  don't link them from tracked docs

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
- Retire docs for removed features to `docs/history/` (see [Archiving Documentation](#archiving-documentation))

Maintainers should revise this guide when workflow expectations change or new tooling is adopted.
