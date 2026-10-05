# IxStates Community Feedback Analysis (Discord, June 2026)

**Last updated:** 2026-10-05 (merged in the former `systems/community-feedback-audit.md` as
[How the feedback was addressed](#how-the-feedback-was-addressed))

Analysis of a design debate among Heku (dev), Urcea, and Burg about IxStates' direction. Grounded in
the lore-first platform vision (wiki = truth → maps → mycountry → thinkpages → forum).

## The real framing

Not an argument about features — everyone agrees the systems work and the standardized-data
foundation is the win (Burg: "the absolute legendary value"). The disagreement is about three
non-feature things: **governance, aesthetics, continuity** — and the dev's replies kept answering
with the data model when the concerns were about those.

## 1. Stat-wanking (Burg) — the strongest answer wasn't given

Burg's worry: "I quietly wank my stats and start in a stronger position than I rightfully should."
Replies given ("you cannot just do that" / "there is no stat-wanking" / "you can simply change your
country data") were assertions — and the last one *is the thing he fears*.

The real answer was held but not articulated: distinguish **setup-time configurability** (admin sets a
realm's parameters) from **in-play evolution** (rule-governed by the tier-based growth engine,
historically tracked, audit-logged). "Everything is adjustable" spooked him; "changes are
formula-bound, versioned, and visible" reassures him.

Best pitch: **IxStates makes governance legible.** Old Ixnay relied on someone *noticing* a quiet wiki
edit. The new system is strictly stronger — every change logged/diffable, growth model makes overnight
10× GDP implausible by construction. Not removing the guardrail; replacing "hope someone notices" with
"the ledger shows everything."

## 2. "Gamey systems" (Urcea) — adopt it as the design north-star

Urcea: systems should *serve the story players tell themselves*, not become something to manage. The
actual design already agrees — replacing manual wiki-table maintenance with one action is *less*
management; auto-generating ThinkPages news from diplomatic events is "system serves story" itself.

The miss was rhetorical. "All of ixnay is just some abstraction" was true but unpersuasive (got
"incoherent / I do not like that response"). Adopt Urcea's sentence as the acceptance test ("does this
feel intuitive and serve the story?") and demo through the **narrative output**, not the mechanism.

## 3. Ixnay-vs-IxStates continuity (Burg vs Heku) — he's partly right

Dev wants "seamless mechanical expansion of ixnay." Burg: they're different experiences (reflective
hand-wavium worldbuilding vs. real-time data-grounded engine) and Ixnay players will resist constraint.
He's right the *texture* changes; denying it backfires. Reconciliation = the vision itself: data IS the
lore ("no difference between written words and the world"), held as **a living ledger, not a cage** —
players still drive the narrative; the engine keeps the ledger honest and surfaces it.

## Meta-pattern

"Develop through previews/feedback" — this thread *is* that loop working. Concerns are reasonable and
governance-shaped; replies trended defensive in three spots. When a smart, sympathetic collaborator
keeps circling the same worry, it's usually real and under-communicated, not wrong. The closing instinct
("give me examples to show and bridge the gap") is correct — the gap is **demonstration + framing**, not
missing features.

## Three demos to bridge the gap (each uses things that already exist)

1. **For Burg (governance):** a country's stat-change history/diff timeline + the growth engine
   flagging/smoothing an implausible jump. "Here's why you can't quietly become the Cronan Hegemon —
   logged, visible, trajectory-bound." Make the guardrail visible.
2. **For Urcea (story-first):** one diplomatic action → auto-generated ThinkPages news post +
   wiki-ready paragraph, zero table editing. Input = one intent; output = narrative.
3. **For continuity (novices/Spelf):** walk one ported Ixnay nation's change through
   wiki → data → map → ThinkPages — same world, just live. Also reframes why "configurable" should
   comfort a novice (nothing locked) rather than alarm a veteran (changes are governed).

## Blunt caution

The most powerful unifying idea — "data = lore = world" — is also what triggers Burg (RP must now
reconcile with data). Don't resolve it by insisting there's no trade-off. There *is* a texture change;
win by showing the trade is favorable: trade hand-wavium for a world where story and numbers can never
silently disagree. Name the trade instead of denying it.

---

## How the feedback was addressed

Later co-design sessions with **Urcea**, **Keaor**, **Burg** and **Heku** (summarised in August 2026) turned these
positions into the design of the Intent Engine, the Command Surface and the Statecraft loop of MyCountry. Status
notes were checked against the code on 2026-10-05; open items are in the [backlog](../roadmap/backlog.md).

### Urcea — narrative first

*"Systems should serve the story players tell themselves, not become something to manage."* Urcea objected to
"cognitive friction", where a formula contradicts what players agreed in roleplay (for example, penalising two nations
that chose to be close allies).

- **Qualitative bands** (Tense, Neutral, Cooperative) on the home surface instead of raw percentages.
- **The canonical loop:** action → world effect → narrative → ledger. One declared intent produces a computed effect
  and a ThinkPages headline, with no manual wiki-table edits.
- **Proactive / reactive split:** Directives for initiatives, the Issues inbox for situations.

### Keaor — political structure

*"Mechanics must reflect political realities, asymmetry, and delegation."*

- **Relative-development asymmetry:** free trade with a poor nation is not free trade with a rich one, so benefits
  should be priced by both nations' tiers. Status: shown on embassy cards; not yet used in trade maths.
- **Coalitions and mandate:** a leader balances cabinet support and party polling, which became the Mandate and
  Cabinet Deliberation designs. Status: cabinet meetings conclude with decisions; the deliberation loop and mandate as a
  gate are not built.
- **Civil Service Capacity (CivCap):** shown as `Allocated (+Temp) / Total`, for example `100 (+50) / 300`
  (`src/lib/government/civcap.ts`).
- **Issue delegation:** hand a non-urgent issue to the civil service for 15 CivCap (`DELEGATED_ISSUE_CIVCAP`).

### Burg — guardrails

*"The engine must prevent unearned power."*

- **Stat inflation:** players must not be able to inflate numbers into unearned dominance.
- **Legible governance:** every stat change should be visible and auditable. This became the executive record on
  MyCountry (`ExecutiveRecordFeed`), fed by bounded changes from the event spine.

### Heku — integration

*"Data = Lore = World."*

- **Hiding the math:** qualitative bands on the Command Surface, the formulas in drill-down sheets.
- **The narrative spine:** `CountryEventSpine` (`src/lib/activity/event-spine.ts`) applies a bounded stat change
  (clamped per field), writes the ledger and publishes the headline, serving Burg and Urcea at once. Status: directives
  use it (`routers/intent.ts`); diplomacy, defense, elections and meetings don't yet.

### The resulting Statecraft loop

1. **IN:** the world (or power brokers) presents an issue or crisis.
2. **SEE:** the player spends CivCap to assess it, limited by information fog.
3. **OUT:** the player declares an intent or directive, or responds to the issue.
4. **RIPPLE:** the engine clamps the change, writes it to the ledger (Burg's guardrail) and broadcasts the story to
   ThinkPages (Urcea's canonical loop).

The loop's design and what is built are tracked in
[statecraft-game-loops.md](../systems/statecraft/statecraft-game-loops.md).
