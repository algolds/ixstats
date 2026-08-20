# NPC Personality & Behavioral AI System

**Last updated:** August 2026  
**Status:** Production Ready (Beta)  
**Hierarchy:** Subsystem of Concord Living-World Engine (`CONCORD_ENGINE_VERSION = 2`).

The NPC Personality and Behavioral AI system creates distinct, data-driven personalities for non-player nations based on observable database metrics. It drives autonomous diplomatic behavior, event responses, negotiation postures, and relationship evolution.

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

1. **Aggressive Expansionist** (High Assertiveness, High Risk Tolerance, High Militarism, Low Cooperativeness)
2. **Pragmatic Trader** (High Economic Focus, High Cooperativeness, Low Ideological Rigidity)
3. **Cultural Diplomat** (High Cultural Openness, High Cooperativeness, Low Isolationism)
4. **Defensive Isolationist** (High Isolationism, Low Risk Tolerance, Low Cooperativeness)
5. **Ideological Crusader** (High Ideological Rigidity, High Assertiveness, Selective Cooperativeness)
6. **Security Hawk** (High Militarism, High Assertiveness, Security-Focused Cooperativeness)

---

## Behavioral Response Prediction

When a player proposes an action (embassy, trade pact, alliance, cultural exchange), `NPCPersonalitySystem.predictResponse()` evaluates:
$$\text{Base Score} = \text{RelationshipStrength} + \sum(\text{TraitWeight} \times \text{TraitValue}) - \text{ConcessionPenalty} \pm \text{RiskModifier}$$

The prediction outputs probabilities for:
- **Accept**: Direct approval
- **Counter**: Proposes modified terms or extra compensation
- **Reject**: Flat refusal

---

## Personality Drift

Personalities drift gradually over time (clamped to $\le \pm 2$ points per IxTime year per trait) based on recorded experiences:
- Successful trade agreements increase Economic Focus and Cooperativeness.
- Unprovoked sanctions or military conflicts increase Assertiveness and Militarism.
- Peaceful conflict resolutions reduce Militarism and increase Cooperativeness.

---

## Routers & Files
- **Router**: `src/server/api/routers/npcPersonalities/` (`index.ts`, `query.ts`, `diplomacy.ts`, `admin.ts`)
- **Core Library**: `src/lib/diplomatic-npc-personality.ts` (`NPCPersonalitySystem` class)
- **Cultural Participation**: `src/lib/npc-cultural-participation.ts`
- **Markov Engine**: `src/lib/diplomatic-markov-engine.ts`

---

## Related Documentation

- [Diplomacy System Guide](./diplomacy.md)
- [Crisis Events Guide](./crisis-events.md)
- [API Reference: NPC Personalities](../reference/api-complete.md#npc-personalities-router)
