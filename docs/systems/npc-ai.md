# NPC Personality & Behavioral AI System

**Last updated:** September 2026  
**Status:** Partial — trait engine live for cultural-exchange responses; drift not wired  
**Hierarchy:** Subsystem of Concord Living-World Engine (`CONCORD_ENGINE_VERSION = 2`).

The NPC Personality and Behavioral AI system creates distinct, data-driven personalities for non-player nations based on observable database metrics. It is designed to drive autonomous diplomatic behavior, event responses, negotiation postures, and relationship evolution. Today it powers NPC participation in cultural exchanges (`diplomaticCultural.getNPCCulturalResponses`).

---

## Personality Traits (0–100 Scale)

All 8 traits are calculated dynamically from observable database data rather than hardcoded:

| Trait | Definition | High Spectrum Behavior | Key Data Inputs |
| :--- | :--- | :--- | :--- |
| **Assertiveness** | Willingness to take aggressive diplomatic stances | Demands concessions, issues ultimatums | Hostile relationships, conflict history, failed negotiations |
| **Cooperativeness** | Preference for multilateral partnerships | Seeks alliances, proposes joint treaties | Alliance count, friendly relationships, active treaties |
| **Economic Focus** | Prioritization of trade and mercantile growth | Trade deals prioritized, economic leverage used | Trade-to-GDP ratio, trade treaties, economic embassies |
| **Cultural Openness** | Receptiveness to soft power and cultural exchanges | Embraces student programs, festivals, arts | Cultural exchange levels, cultural embassies |
| **Risk Tolerance** | Willingness to make unconventional diplomatic moves | Bold initiatives, gambles on crisis outcomes | Hostile neighbors, deteriorating relations, policy volatility |
| **Ideological Rigidity** | Adherence to principles vs pragmatic flexibility | Principled stances, refuses ideological compromises | Policy consistency, alliance longevity, partner alignment |
| **Militarism** | Preference for hard power and defense posture | Security-first, defense pacts prioritized | Security embassies, mutual defense treaties, defense budget % |
| **Isolationism** | Preference for minimal international entanglements | Self-reliance focus, slow to answer proposals | Low embassy count, low treaty participation, domestic focus |

---

## Personality Archetypes

Calculated trait combinations determine an NPC nation's active behavioral archetype:

1. **Aggressive Expansionist** (`aggressive_expansionist`: Assertiveness ≥ 70, Militarism ≥ 60, Risk Tolerance ≥ 65, Cooperativeness ≤ 40)
2. **Peaceful Merchant** (`peaceful_merchant`: Economic Focus ≥ 70, Cooperativeness ≥ 60, Militarism ≤ 40, Isolationism ≤ 40)
3. **Cautious Isolationist** (`cautious_isolationist`: Isolationism ≥ 65, Risk Tolerance ≤ 40, Cooperativeness 40–70)
4. **Cultural Diplomat** (`cultural_diplomat`: Cultural Openness ≥ 70, Cooperativeness ≥ 70, Militarism ≤ 45, Assertiveness ≤ 60)
5. **Ideological Hardliner** (`ideological_hardliner`: Ideological Rigidity ≥ 70, Assertiveness ≥ 50, Risk Tolerance ≥ 50, Cooperativeness ≤ 45)
6. **Pragmatic Realist** (`pragmatic_realist`: the default for balanced profiles)

---

## Behavioral Response Prediction

`NPCPersonalitySystem.predictResponse()` has scenario-specific predictors (alliance, trade dispute, cultural exchange, sanction, mediation, treaty, embassy, security pact, generic). Only the cultural-exchange path is called from live code (`src/lib/diplomacy/npc-cultural-participation.ts`). Each predictor evaluates:
$$\text{Base Score} = \text{RelationshipStrength} + \sum(\text{TraitWeight} \times \text{TraitValue}) - \text{ConcessionPenalty} \pm \text{RiskModifier}$$

The prediction returns a `predictedAction` with confidence:
- **accept**: Direct approval
- **negotiate**: Proposes modified terms or extra compensation
- **reject**: Flat refusal
- **escalate** / **defer**: Hard-line or wait-and-see responses

---

## Personality Drift

`NPCPersonalitySystem.applyPersonalityDrift()` implements gradual drift (at most $\pm 2$ points **total** per IxTime year across all traits) based on recorded experiences. **It has no callers yet**, so personalities do not currently drift:
- Successful trade agreements increase Economic Focus and Cooperativeness.
- Unprovoked sanctions or military conflicts increase Assertiveness and Militarism.
- Peaceful conflict resolutions reduce Militarism and increase Cooperativeness.

---

## Routers & Files
- **Router**: `src/server/api/routers/npcPersonalities/` (`index.ts`, `query.ts`, `admin.ts`) – `getAllPersonalities` plus admin `create` / `update` / `deletePersonality` and `assignPersonalityToCountry` (UI: `/admin/npc-personalities`)
- **Core Library**: `src/lib/diplomacy/npc-personality.ts` (`NPCPersonalitySystem` class)
- **Cultural Participation**: `src/lib/diplomacy/npc-cultural-participation.ts`, `src/server/api/routers/diplomacy/cultural/npc/`
- **Markov Engine**: `src/lib/diplomacy/markov-engine.ts`

---

## Related Documentation

- [Diplomacy System Guide](./diplomacy.md)
- [Crisis Events Guide](./crisis-events.md)
- [API Reference: NPC Personalities](../reference/api-complete.md#intelligence--diplomacy)
