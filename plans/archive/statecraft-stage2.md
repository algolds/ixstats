# Statecraft — Stage 2 scope (Diplomacy interconnect)

Date: 2026-06-25 · branch v2. Implements Stage 2 of `plans/mycountry-statecraft.md` (after the Stage 1
spine shipped). The Diplomacy arena of the loop: **IN** (foreign overture/threat) → **SEE** (intel
briefing, fogged) → **OUT** (Foreign Policy / Diplomatic Event), resolving by **foreign consent**, with
effects **scaled by the target's relative stats** (Keaor's "free trade with Pooristan ≠ Goldland").

## The big de-risk (again)

Diplomacy is the most-built arena already: `ForeignPolicyAction` (with `initiator/targetGdpImpact`,
`relationshipDelta`, status `proposed→active→expired→lifted`), `Embassy` + `EmbassyMission`
(cost→`influenceReward`/`reputationReward`/`economicReward`, a working event engine), `DiplomaticRelation`
(strength), `BilateralTrade`, `Alliance`, `CulturalExchange`, and `diplomatic-news-generator` (auto-news).
Stage 2 is **connective tissue on top of this**, not greenfield.

**Gotcha found:** the foreign-policy impact switch is **duplicated** — `foreignPolicy.ts` has it in both
`previewForeignPolicyImpact` (~L199-230) and `proposeForeignPolicyAction` (~L369+). S2.A de-dupes it.

## Slices

### S2.A — Target-scaled foreign-policy effects (the interconnect core). ✅ DONE 2026-06-25
Built `src/lib/statecraft-foreign-policy.ts` `computeForeignPolicyImpact` (+test, 5 green) with the
relative-development asymmetry (richer partner → more GDP for you; bigger gap → bigger relations boost;
poorer side out-gains). De-duped: both `previewForeignPolicyImpact` and `proposeForeignPolicyAction` in
`foreignPolicy.ts` now call it (deleted the two copied switches); `inputType` kept (it's how the effect
applies, not magnitude). Lint clean, no migration. Military/geo blockade scaling still deferred.

Extract the duplicated impact switch into a pure `computeForeignPolicyImpact()`
(`src/lib/statecraft-foreign-policy.ts`), used by both the preview and propose paths. **Enhance** the
symmetric cases with Keaor's relative-development asymmetry:
- **free_trade** is currently symmetric (+0.003 both). Make it scale by `devRatio = target.gdpPerCapita
  / initiator.gdpPerCapita`: a richer partner gives *you* more GDP; a poorer partner gives you less **but
  a bigger relations boost** (the imbalance benefits relations — the poorer side gains more %).
- embargo/sanction/blockade already scale by `tradeShare`; keep, but route relations delta through the
  same imbalance factor.
- **Military/geo scaling for blockade** (blockader projection vs defender navy + coastline) is deferred —
  needs military-strength + coastline plumbing; note it, don't block S2.A on it.
Pure + tested (asymmetry monotonicity: richer target → larger initiator gain; bigger gap → bigger
relations delta). Wire both call sites; delete the dup.

### S2.B — Diplomacy recon (the SEE step; never-lie). ✅ DONE (backend) 2026-06-25
`src/lib/statecraft-diplo-intel.ts` `assessReach` (embassy→revealed / loose ties→questioned /
none→greyed) + `fogNumber` (revealed=exact, questioned=2-sig-fig estimate, greyed=null; never
fabricates) +test (5 green). Query `api.diplomaticPolicies.getForeignIntel({targetId})` returns the
target's stats fogged by YOUR reach (embassy + relation). Unilateral. *Capacity-timed briefing deferred*
(needs per-pair persistence) — reach-based fog ships the SEE essence now. **UI ✅** — intel block + reach
caption in `ForeignPolicyCreatorSheet` (`IntelStat`: greyed "—", questioned "~").

### (original) S2.B — Diplomacy recon (the SEE step; never-lie; spends Capacity)
An **intelligence briefing** on a target: spend Capacity to reveal the target stats that feed
`computeForeignPolicyImpact` (their GDP/capita, trade exposure, military) — **fogged by YOUR reach into
them**: no embassy / weak intel → greyed or questioned (you propose blind). Reuses the Stage 1 never-lie
pattern (`statecraft-recon.ts` generalized, or a sibling) and the Capacity lever. This makes
`previewForeignPolicyImpact` return a *fogged* estimate unless you've scouted. Recon is **unilateral**
(you scout via your own intel — never blocks on the other human; the design's locked fork).

### S2.C — Diplomatic Events (the OUT step; foreign consent). ✅ DONE (backend) 2026-06-25
Reused `ForeignPolicyAction.status` (no migration). Extracted `enactForeignPolicyEffects(db, actionId,
actorUserId)` (the effects+relation+trade+news transaction, idempotent) shared by both paths. Cooperative
(`free_trade`, `military_alliance`) → propose creates `status:"proposed"`, no effects yet; hostile
(embargo/sanction/blockade) → propose enacts immediately (`active`). New `getForeignPolicyProposals(
{countryId})` (incoming proposed) + `respondToForeignPolicyProposal({actionId, choice})` (target-only:
accept→enact→active, decline→declined). **UI ✅** — `ForeignPolicyProposalsInbox`
(accept/decline) in `ForeignPolicyPanel`; creator-sheet success msg now distinguishes "Proposal sent"
(cooperative, awaiting consent) vs "enacted" (hostile). Defers the
joint-deployment event tier (catalog only).

### (original) S2.C — Diplomatic Events (the OUT step; foreign consent; bilateral)
Resolution by consent: **cooperative** actions (free_trade, military_alliance, state visit, joint
exercise, intel sharing, foreign investment…) require the **target to accept** before activating;
**hostile** actions (embargo, sanction, blockade) stay unilateral. Implement as a proposal/accept state
machine on `ForeignPolicyAction.status` (`proposed → accepted → active`, or `declined`). Cooperative
"events" mature into influence/reputation/relations via the existing `EmbassyMission` reward fields;
some unlock stronger premade policies on maturity. **Defer** the most elaborate joint-deployment events
(joint exercise tying to Deployments, joint blockade splitting requirements) — catalog them, ship the
state-visit / trade-negotiation / intel-sharing tier first.

## Reuse map
| Stage 2 piece | Existing code |
|---|---|
| Effect computation | `diplomacy/policies/foreignPolicy.ts` (dup switch → extract) |
| Relations + validation | `DiplomaticRelation.strength`, the propose validation guards |
| Event rewards | `EmbassyMission` cost→influence/reputation/economic |
| Auto-news on commit | `diplomatic-news-generator.ts` |
| Recon fog | `src/lib/statecraft-recon.ts` (Stage 1) |
| Capacity lever | `loadReconContext` pattern (national-issues/player.ts), `getCivilServiceStatus` |

## Build order
**S2.A** (pure scaled-impact + de-dup, no migration) → **S2.B** (diplomacy recon, reuses Capacity + fog)
→ **S2.C** (consent state machine + event catalog; likely a small additive `ForeignPolicyAction` field
or reuse of `status`). S2.A is the clean, high-value, mostly-extraction start.

## Out of Stage 2
Politics/Bills (Stage 3), Power Brokers (Stage 4), full joint-deployment events, military/geo blockade
math (needs military-stat plumbing — own ticket).
