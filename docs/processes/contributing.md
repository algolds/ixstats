# Contributing Guide

**Last updated:** October 2025

This guide outlines expectations for contributing to IxStats. Use it alongside the architectural and system docs when planning work.

## Workflow
1. Create a feature branch from `main` with a descriptive name
2. Install dependencies and prepare the database (`npm install`, `npm run db:setup`)
3. Implement changes with accompanying tests and documentation updates
4. Run quality gates: `npm run test`, `npm run audit:wiring`, `npm run typecheck:app`
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
- Consider Playwright scenarios for UX-critical paths

## Review Checklist
- Does the change respect rate limiting and auth boundaries?
- Are environment variables documented if introduced?
- Are WebSocket events handled gracefully (if applicable)?
- Has the help center been updated for user-facing changes?

## Release Guidance
- Tag releases in CHANGELOG (if maintained separately)
- Run deployment checklist from `docs/operations/deployment.md`
- Archive legacy docs under `docs/archive/<date>` when retiring features

Maintainers should revise this guide when workflow expectations change or new tooling is adopted.
