# National Issues Engine

**Last updated:** May 2026

The National Issues system generates dynamic decisions and events for country owners. Issues appear in a player's inbox based on their country's economic, political, and social conditions. Responding to issues triggers consequences that modify country metrics.

## Overview

| Feature | Description |
| --- | --- |
| Template-driven issues | Admin-authored templates with trigger conditions and response options |
| Lazy evaluation | Issues are generated on-demand when a player queries their inbox |
| Consequence engine | Responses modify country metrics (GDP, stability, approval) via typed effects |
| Follow-up chains | Issues can trigger follow-up issues based on player choices |
| Variable substitution | Template text dynamically inserts country-specific data |
| Admin preview | Test templates against any country without creating real issues |
| Severity & urgency | Issues are prioritised by severity (critical/high/medium/low) and urgency score |

## Key Files

### Engine
| File | Purpose |
| --- | --- |
| `src/lib/national-issues-engine.ts` | Core engine: evaluation, condition matching, country snapshots, variable substitution, force generation |
| `src/lib/national-issues-consequences.ts` | Consequence resolver: applies effects to country models |

### Router
| File | Purpose |
| --- | --- |
| `src/server/api/routers/national-issues.ts` | 937-line tRPC router with 17 procedures |

### Components
| File | Purpose |
| --- | --- |
| `src/components/national-issues/IssuesInbox.tsx` | Player inbox for pending issues |
| `src/components/national-issues/IssueCard.tsx` | Individual issue card |
| `src/components/national-issues/IssueDetailModal.tsx` | Detailed view with response options |
| `src/components/national-issues/IssueCountBadge.tsx` | Badge showing pending issue count |
| `src/components/national-issues/index.ts` | Barrel export |

### Pages
| File | Purpose |
| --- | --- |
| `src/app/admin/national-issues/page.tsx` | Admin template management interface |
| `src/app/help/gameplay/national-issues/page.tsx` | Help article for players |

## API Procedures

### Player Endpoints
| Procedure | Type | Auth | Description |
| --- | --- | --- | --- |
| `getMyIssues` | query | protected | Get issues with filtering by status/domain, triggers lazy evaluation |
| `getIssue` | query | protected | Get single issue with consequences |
| `markViewed` | mutation | protected | Mark an issue as viewed |
| `respond` | mutation | protected | Submit a response to an issue (core player action) |
| `dismiss` | mutation | protected | Dismiss non-urgent issues (no deadline only) |
| `getPendingCount` | query | protected | Badge count: total pending + urgent with deadlines |
| `getHistory` | query | protected | Paginated history of resolved/expired issues |
| `getConsequences` | query | protected | Consequences applied for a specific issue |
| `getRecentWorldIssues` | query | public | Splash/discovery: one randomized issue per nation |

### Admin Endpoints
| Procedure | Type | Auth | Description |
| --- | --- | --- | --- |
| `getTemplates` | query | admin | List templates with filtering and search |
| `getTemplate` | query | admin | Single template with instance count |
| `createTemplate` | mutation | admin | Create a new issue template |
| `updateTemplate` | mutation | admin | Update an existing template |
| `deleteTemplate` | mutation | admin | Delete a template |
| `toggleTemplateActive` | mutation | admin | Enable/disable a template |
| `previewTemplate` | query | admin | Preview a template rendered against a specific country |
| `forceGenerate` | mutation | admin | Force-generate an issue for testing |
| `batchCreateTemplates` | mutation | admin | Batch create/upsert templates for seeding |
| `getGenerationStats` | query | admin | Generation statistics (evaluations, execution time, domain/status distribution) |
| `triggerEvaluation` | mutation | admin | Manually trigger issue evaluation for a country |

## Issue Lifecycle

```
Template → Evaluation → [pending] → [viewed] → [responded] → Consequences
                                  ↘ [expired]  (deadline passed)
                                  ↘ [dismissed] (player dismissed, no deadline only)
                                  ↘ [auto_resolved] (system auto-resolve)
```

1. **Template authoring**: Admins create `NationalIssueTemplate` records with trigger conditions (JSON expression tree), response options, and consequence definitions
2. **Lazy evaluation**: When `getMyIssues` is called, the engine checks if evaluation is due and runs `NationalIssuesEngine.evaluateCountry()` in the background
3. **Country snapshot**: The engine builds a snapshot of the country's current state (GDP, population, unemployment, inflation, approval, stability)
4. **Trigger matching**: Each active template's trigger conditions are evaluated against the snapshot
5. **Issue generation**: Matching templates create `NationalIssue` records with substituted text
6. **Player response**: The player picks a response option, triggering `NationalIssuesConsequences.resolveIssue()`
7. **Consequence application**: Effects are applied to country models (add/subtract/multiply/set operations)

## Template Schema

### Domains
`economic`, `political`, `social`, `military`, `diplomatic`, `infrastructure`, `environmental`

### Categories
`economic`, `diplomatic`, `social`, `governance`, `security`, `infrastructure`

### Severity Levels
`critical`, `high`, `medium`, `low`

### Consequence Definition
```typescript
{
  targetModel: string;     // e.g. "country"
  targetField: string;     // e.g. "adjustedGdpGrowth"
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
  effectType?: "immediate" | "gradual";
  durationDays?: number;
}
```

### Response Option
```typescript
{
  id: string;
  label: string;
  description: string;
  consequences: ConsequenceDefinition[];
  previewEffects: {
    publicApproval?: number;
    economicImpact?: string;
    stabilityImpact?: string;
    diplomaticImpact?: string;
  };
  outcomeText: string;
  isAutoResolveDefault?: boolean;
  triggersFollowUp?: string[];
}
```

## Database Models

| Model | Purpose |
| --- | --- |
| `NationalIssueTemplate` | Admin-authored templates with trigger conditions and response options |
| `NationalIssue` | Generated issue instances linked to countries |
| `NationalIssueConsequence` | Applied consequences with before/after values |
| `IssueGenerationLog` | Evaluation logs with execution time and issue counts |

## Splash Showcase

The `getRecentWorldIssues` endpoint seeds up to 18 showcase issues across different nations for the guest splash page. This runs idempotently — once seeded, the same showcase issues persist.

## Related Documentation
- [`docs/systems/mycountry.md`](mycountry.md) — Executive command suite
- [`docs/systems/crisis-events.md`](crisis-events.md) — Related crisis management system
- [`docs/reference/api-complete.md`](../reference/api-complete.md) — Full API catalog
