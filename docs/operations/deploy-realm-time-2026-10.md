# Deploy runbook: realm time (2026-10)

Draft; WP-T5 owns the final shape. Each work package adds its steps under its own heading. SQL files live in
`scripts/migrations/2026-10-realm-time/` and are idempotent.

```bash
cd /ixwiki/public/projects/ixstats
run_sql() { docker exec -i ixstats-postgres psql -U postgres -d ixstats -v ON_ERROR_STOP=1 < "$1"; }
```

## D1: defense budget and legacy security tables

- **After the realm-time code is deployed** (the old build still reads these tables), and after `bun run db:backup`:
  `run_sql scripts/migrations/2026-10-realm-time/d1-drop-legacy-security.sql`. It drops `NeighborThreatAssessment`,
  `BorderSecurity`, `ThreatIncident`, `SecurityThreat`, `SecurityEvent`, `SecurityAssessment` and `DefenseBudget`
  (with `CASCADE`, children first) and the `ThreatType`, `ThreatSeverity` and `ThreatStatus` enums. Row counts on the
  clone `ixstats_wv1` (2026-10-25): `DefenseBudget` 1, `SecurityAssessment` 15, `BorderSecurity` 7,
  `NeighborThreatAssessment` 0, `SecurityThreat` 0, `ThreatIncident` 0, `SecurityEvent` 0. Nothing is migrated: the
  assessment and border rows were never written past their defaults, and the one `DefenseBudget` row is replaced by
  the nation's Defense department allocation in the National budget (on the clone it is the E2E Testland test row).
