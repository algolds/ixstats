# Plan 055: Policy Treasury Debits

## Status
- **Priority**: P1
- **Status**: DONE (Verified)
- **Planned**: June 2026

## What Changed
1. Developed [policy-maintenance-cron.ts](file:///home/jxsig/projects/ixstats/src/lib/policy-maintenance-cron.ts) to find all active policies and periodically debit their `maintenanceCost` from their respective country's budget treasury (`GovernmentStructure.totalBudget`).
2. Logged the debit events via `CountryEventSpine.recordCountryEvent` so they print clear line-item ledger logs on the player's Country Change Log timeline.
3. Registered the new background job inside the server initialization loop in [server.mjs](file:///home/jxsig/projects/ixstats/server.mjs) on a recurring 6-hour interval.
