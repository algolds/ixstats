# Monitoring & Observability

**Last updated:** October 2025

Monitoring combines server logs, Discord webhooks, audit scripts, and compliance tooling to keep IxStats healthy.

## Runtime Monitoring
- **Error Logger** – `~/lib/error-logger` captures API errors and forwards them to Discord when `DISCORD_WEBHOOK_ENABLED=true`
- **User Activity Logging** – `~/lib/user-logging-middleware` records API usage for compliance and analytics
- **Rate Limiting** – `~/lib/rate-limiter` surfaces throttle breaches; watch for warnings in server logs

## Alerts & Notifications
- **Discord Webhooks** – Configure `DISCORD_WEBHOOK_URL` for production alerts
- **In-App Notifications** – `notifications.ts` router emits alerts for compliance, diplomacy, defense, and social events
- **Help System** – `/help` articles include operational runbooks for on-call responders

## Scheduled & Manual Audits
Located in `scripts/audit/`:
- `audit-trpc-wiring.ts` (`npm run audit:wiring`) – Ensures front-end procedures map to live routers
- `run-all-tests.ts` (`npm run test:all`) – Aggregated regression suite
- `verify-economic-calculations.ts`, `verify-database-integrity.ts` – Spot-check critical calculations and schema health
- `audit-production-urls.ts` – Validates page availability under production base path

## Incident Response
- Historical runbooks retained in `docs/archive/v1/INCIDENT_RESPONSE_RUNBOOK.md`
- Use compliance modal (`MyCountryComplianceModal.tsx`) to surface outstanding operational risks to admins

## Logging Strategy
- `server.mjs` writes structured logs prefixed with `[Server]`
- Router-level logs exist for critical endpoints (e.g., `countries.getByIdWithEconomicData` debug statements)
- Consider piping logs into a centralised system for long-term retention when moving to dedicated hosting

Keep this guide aligned with new alert channels or monitoring scripts. Update the help center with user-facing instructions whenever operational responses change.
