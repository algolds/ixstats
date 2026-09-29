---
title: How Your Economy Is Calculated
description: A plain-language guide to the formulas behind your GDP, growth rate, projections, and economic health scores.
badge: Economy & Finances
prevHref: /help/economy/tiers
prevLabel: Economic Tiers
nextHref: /help/economy/modeling
nextLabel: Modeling & Projections
---

## GDP: The Big Number

Your country's **Gross Domestic Product (GDP)** is the single most important economic figure. It represents the total value of everything your nation produces and is calculated with a simple formula:

**Total GDP = Population × GDP per Capita**

**GDP per Capita** is the average economic output per person. A nation of 50 million people with a GDP per Capita of $40,000 has a total GDP of $2 trillion.

## What Drives Growth

Your GDP does not stay still. Every in-game cycle, your economy is recalculated from several factors:

- **Base growth rate** — determined by your country's [economic tier](/help/economy/tiers). Poorer nations can grow faster (up to 10%), while wealthy nations grow more slowly (as low as 0.5%).
- **Global growth factor** — a world-wide multiplier (1.0321 by default — a 3.21% boost) that raises or lowers everyone's growth to simulate global economic conditions.
- **Local growth factor** — unique to your nation, reflecting the quality of your government policies, tax system, and infrastructure.
- **Storyteller events** — trade agreements, natural disasters, economic policies, and special events created by the DM can temporarily boost or reduce your growth.
- **Diminishing returns** — extremely wealthy nations (those with very high GDP per Capita) see their growth taper off naturally, preventing runaway economies.

After all modifiers are applied, your growth rate is capped by your [tier's maximum](/help/economy/tiers) so that no single event can push growth beyond a realistic ceiling.

## Tier-Based Growth Caps

Your [economic tier](/help/economy/tiers) sets a hard ceiling on how fast your GDP per Capita can climb each cycle:

| Tier | GDP per Capita | Max Growth |
| --- | --- | --- |
| Impoverished | $0 – $9,999 | 10.0% |
| Developing | $10,000 – $24,999 | 7.5% |
| Developed | $25,000 – $34,999 | 5.0% |
| Healthy | $35,000 – $44,999 | 3.5% |
| Strong | $45,000 – $54,999 | 2.75% |
| Very Strong | $55,000 – $64,999 | 1.5% |
| Extravagant | $65,000+ | 0.5% |

This means a Developing nation can catch up quickly, but growth naturally slows as your economy matures. Strategic policy choices become more important at higher tiers.

## Economic Health Scores

Beyond raw GDP, IxStats tracks several composite scores that measure different dimensions of your economy's health:

- **Economic Resilience Index (ERI)** — how well your economy can absorb shocks like recessions, natural disasters, or diplomatic crises. A high ERI means your nation bounces back faster.
- **Policy Impact Index (PII)** — measures how effectively your government policies translate into real economic results. Better policy alignment means a higher PII.
- **Social-Economic Welfare Index (SEWI)** — captures the well-being of your citizens beyond just money, including factors like income equality, public services, and quality of life.
- **Economic Complexity & Trade Index (ECTI)** — reflects how diversified and sophisticated your economy is. Nations that rely on a single export score lower than those with broad, complex economies.

These scores are calculated behind the scenes and feed into your nation's numbers; your economic complexity index appears in MyCountry → Economy & Budget. They update automatically as your economy evolves.

## How Projections Work

IxStats can forecast where your economy is heading over a horizon you choose, from one year up to fifty. Projections use your current growth rate, tier, and active modifiers to estimate future GDP, population, and key indicators.

> **What Affects Projections**
>
> - **Current growth rate** — your actual rate after all modifiers, not just the tier maximum.
> - **Population trends** — growing or shrinking population directly shifts your total GDP.
> - **Active events** — ongoing storyteller effects (wars, trade deals, crises) are factored into projections.
> - **Tier transitions** — if your growth is about to push you into a higher tier, the projection accounts for the lower growth cap you will face.

You can explore projections in detail using the [Modeling & Projections](/help/economy/modeling) tools, which let you test “what if” scenarios before committing to policy changes.

## The Role of IxTime

All economic calculations run on [IxTime](/help/getting-started/ixtime), the in-game clock that moves at twice the speed of real time. Growth rates, projections, and historical records all reference IxTime months and years rather than real-world dates. This means your economy evolves roughly twice as fast as you might expect from the raw percentage numbers.

## Where to Check Your Numbers

> **Quick Reference**
>
> - **MyCountry Overview** — shows your population and GDP at a glance in the National Standing card.
> - **MyCountry → Economy & Budget** — the Economic Report, National Budget, Fiscal Policy, and Trade & Commerce tabs.
> - **Modeling page** — run projections and compare scenarios. Open **Economic Modeling** from a country profile.
> - **Leaderboards** — see how your GDP, growth, and other indicators rank against other nations.
> - **Country profile** — any nation's public profile displays its current economic data and tier.

> [!WARNING]
> **Tips for Healthy Growth**
>
> - Diversify your economy. Nations with a broad range of sectors score higher on the ECTI and recover faster from shocks.
> - Keep an eye on projections after making policy or tax changes — small adjustments compound quickly under IxTime.
> - Review your [tax system](/help/economy/tax-system) regularly. Tax revenue feeds directly into government spending capacity and debt management, both of which influence your growth rate.

## Related Help Pages

- [Economic Tier System](/help/economy/tiers) — how tiers are assigned and why they matter for growth and achievements.
- [Modeling & Projections](/help/economy/modeling) — simulate scenarios and forecast your economy's future.
- [Tax System](/help/economy/tax-system) — configure taxes, brackets, and exemptions that shape your revenue.
- [Trade & Commerce](/help/economy/trade) — how international trade affects your GDP and ECTI score.
- [Understanding IxTime](/help/getting-started/ixtime) — the in-game clock that drives all economic cycles.
