# Statecraft — Stage 3 scope (Politics / Bills)

Date: 2026-06-25 · branch v2. Stage 3 of `plans/mycountry-statecraft.md`. The Politics arena: **IN**
(Bill / coalition demand) → **SEE** (whip count, fogged by your standing) → **OUT** (pass a Bill),
resolving by **legislative vote**. Bills = the *legislature's* verb (vs Policy = the executive's).

## The big de-risk (biggest yet)

The Bills loop is **already closed**: `routers/legislation.ts` (a bill = a Policy tagged
`legislative_bill`) — `proposeBill` → `holdVote` → `tallyVote` (pure, `lib/legislative-vote.ts`) →
`applyPolicyEffect` (the proven sim channel) + auto-news + notification. UI exists too (`BillsPanel`,
`ApprovalPanel`, `PoliticsWarRoom`). So Stage 3 is **connective tissue**, mirroring Stages 1–2.

Two clean gaps, both invited by the code:
- No **whip count** (SEE): you call `holdVote` blind. There's no fogged projection first.
- `tallyVote` is pure-ideology — its own `ponytail:` comment says *"add a cohesion/whip factor … if votes
  ever need to feel negotiated."* That factor is **Mandate** (approval), the design's "Mandate as a gate."

## Slices

### S3.A — Whip count ✅ DONE 2026-06-25
`src/lib/statecraft-whip.ts` `fogVoteProjection(result, standing)` (revealed≥60 exact / questioned≥35
directional / greyed<35; never fabricates) +test. Query `api.legislation.previewBillVote({billId})`
(reuse `tallyVote` + `getGovernmentBacking`). UI: `WhipCount` in `BillsPanel` for in-committee bills.

### S3.B — Mandate factor ✅ DONE 2026-06-25
`tallyVote` gained optional `governmentBacking` (0-1, from approval) — whips up to half the abstaining
seats to yes; omitted = original behavior (back-compat, tested). Fed from `holdVote` (real vote) +
`previewBillVote` (preview matches). **Bonus fix:** `holdVote` read a non-existent `seat.seats` field →
NaN tallies; extracted `loadBlocs` counting 1 seat each (correctness fix in the vote path). 5 whip tests
green, lint clean.

### (original) S3.A — Whip count (the SEE step; never-lie; fogged by standing)
Pure `fogVoteProjection(result, standing)` (`src/lib/statecraft-whip.ts`): runs the *real* deterministic
`tallyVote`, but gates **precision** by the government's standing (approval). Strong standing → exact
yes/no/margin + verdict (revealed); middling → directional only ("leaning pass" / "too close to call",
no seat counts, questioned); weak → "your whips can't read the floor" (greyed). Never fabricates — the
projection is real, only its sharpness is gated. New query `previewBillVote({ billId })` (reuse
`tallyVote` + `computeApproval`). UI: a "Whip Count" preview in `BillsPanel` before `holdVote`.

### S3.B — Mandate factor in the vote (the interconnect; "Mandate as a gate")
Extend `tallyVote(billTarget, blocs, governmentBacking?)` with an **optional** bounded, deterministic
swing: a popular government whips a fraction of abstaining seats to yes (persuasion); default undefined =
current behavior (backward compatible, existing tests unaffected). `governmentBacking = approval/100`.
Feed it from `holdVote` (the real vote) and `previewBillVote` (so the whip count matches). Now a popular
government governs more effectively — Keaor's "cater to other parties to keep approval; minmax unpopular
issues." Pure + tested.

### S3.C — Bills that mandate / unlock (deferred)
Keaor's tier: bills that mandate a policy/relations action, or unlock stronger premade policies on
passage. Catalog only; ship S3.A/B first.

## Reuse map
| Stage 3 piece | Existing code |
|---|---|
| Vote engine | `lib/legislative-vote.ts` `tallyVote` (pure) |
| Bill lifecycle + effect | `routers/legislation.ts` (`holdVote` → `applyPolicyEffect`) |
| Standing / Mandate | `lib/approval.ts` `computeApproval` (parties + stability) |
| Fog pattern | Stage 1 `statecraft-recon.ts`, Stage 2 `statecraft-diplo-intel.ts` |
| UI host | `executive/politics/BillsPanel.tsx` |

## Build order
S3.A (whip fog + previewBillVote + UI) → S3.B (governmentBacking in tallyVote + feed both paths). No
migration (bills ride `Policy`; vote tally is JSON in `reviewNotes`).
