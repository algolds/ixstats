# Plan 001: Intent Engine vs. National Issues — Gameplay Synthesis & Architecture

**Author:** Senior Advisor  
**Status:** PROPOSED  
**Target Architecture:** MyCountry v2 Statecraft Core  

---

## 1. Executive Summary

This plan defines the canonical relationship, structural distinction, and unified gameplay loop between **Proactive Intents/Directives** (the player-driven strategy engine) and **Reactive National Issues** (the engine-driven dilemma inbox).

Coming from **NationStates**, players love the periodic multiple-choice dilemmas of the **Issues System**. However, a pure Issues model makes the player feel like a passive manager reacting to random events. The **Intent Engine** provides proactive executive vision ("I want to expand solar power"), while **National Issues** provide the organic friction, crises, and unintended consequences that challenge that vision.

---

## 2. Core Differences & Operational Roles

| Dimension | Proactive Directives (Intents) | Reactive National Issues |
|---|---|---|
| **Primary Vector** | **Outbound (Player → State)** | **Inbound (Engine → Player)** |
| **Player Action** | Declares a strategic goal in plain language | Chooses between competing policy options (A/B/C) |
| **rhythm** | Cooldown-gated executive rollouts (Cap: 3/week) | Periodic inbox arrivals & crisis alerts |
| **System Purpose** | Expresses executive vision & policy direction | Tests executive alignment, party approval, & crisis management |
| **Cost Model** | Directive Slots (`usedThisWeek / slotCap`) | Civil Service Capacity (`civCapCost` & delegation) |
| **Player Sentiment** | *"Where do I want to take my nation?"* | *"How do I resolve this dilemma/crisis?"* |

---

## 3. The Unified Statecraft Gameplay Loop

Rather than treating Directives and Issues as redundant or isolated, they form a **closed executive feedback loop**:

```
 ┌─────────────────────────────────────────────────────────┐
 │                   1. PROACTIVE INTENT                   │
 │ Player declares an Intent ("Accelerate Industrialization")│
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼ (Commits Policy Package)
 ┌─────────────────────────────────────────────────────────┐
 │              2. STATECRAFT FRICTION & RISKS             │
 │  High-risk directives increase Volatility & CivCap      │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼ (Cron Spawns Issue)
 ┌─────────────────────────────────────────────────────────┐
 │                  3. REACTIVE ISSUE INBOX                │
 │ Engine pushes dilemma: "Capital Smog & Worker Strikes"  │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼ (Player Chooses Response B)
 ┌─────────────────────────────────────────────────────────┐
 │               4. RESOLUTION & FOLLOW-UP                 │
 │ Resolving issue updates ledger & unlocks follow-up CTA  │
 └─────────────────────────────────────────────────────────┘
```

---

## 4. Ponytail Simplicity Architecture (YAGNI & No Bloat)

To keep implementation lean, maintainable, and free of over-engineered AI generators or complex DAG graphs (`ponytail:lite`):

### A. Intent → Issue Trigger (Directives Cause Friction)
- When a player commits a **Moderate** or **Extreme** intent in `intent.ts`:
  - Tag the country's `policy` or `intent` record with `riskRating: "volatile"`.
  - The existing background maintenance cron (`policy-maintenance-cron.ts`) rolls a check against `riskRating`. If volatile, it pulls a matching `NationalIssueTemplate` matching the intent's `category` and spawns a `NationalIssue`.

### B. Issue → Intent Trigger (Crises Inspire Directives)
- When a player resolves a `NationalIssue` in `player.ts`:
  - The response payload includes a `recommendedDirective` string (e.g. *"Establish Clean Industrial Subsidies"*).
  - In `IssuesInbox.tsx`, upon resolving an issue, a 1-click CTA button is rendered: **"Declare Follow-Up Directive →"**, which pre-fills the `IntentComposer` modal.

---

## 5. Implementation Roadmap

### Phase 1: Contextual Cross-Linking (Lightweight)
- [ ] **Issue Resolution CTA**: Add a **"Declare Directive to Address"** button in `IssuesInbox.tsx` when an issue is resolved, opening `IntentComposer` with pre-filled goal text.
- [ ] **Hero Integration**: In `V2OpportunityHero.tsx`, ensure active high-urgency issues and high-tier intents feed into the hero briefing dynamically.

### Phase 2: Volatility Spawning (Cron Coupling)
- [ ] In `policy-maintenance-cron.ts`, update `spawnVolatileIssues()` to inspect active `Intent` records of tier `extreme` alongside `Policy` records.

---

## 6. Verification & Done Criteria

1. **Self-Contained Execution**: All schemas rely on existing `NationalIssue` and `Intent` Prisma models.
2. **Zero Duplicate UI**: `V2MyAgenda` handles executive timeline, `V2Agenda` handles active directives rail, and `IssuesInbox` handles reactive dilemmas.
3. **No Over-Engineering**: No new models or complex DAGs required.
