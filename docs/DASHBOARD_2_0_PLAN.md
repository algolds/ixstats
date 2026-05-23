# IxStats Dashboard 2.0 — Plan

## Theme: Twitter-like Three-Column Layout with Interactive World Map Hero

### Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│               HERO — "YOUR NATION" (ambient, collapsible)              │
│  ┌──────────────────────────┐  ┌─── At a Glance ─────────────────────┐ │
│  │ 🌍 Interactive World Map │  │  GDP/Cap: $42.5K  Tier: 3          │ │
│  │   • Your country glowing │  │  Population: 58.2M  Rank: #142     │ │
│  │   • Activity pulse dots  │  │  ─────────────────────────────      │ │
│  │   • Crisis hotspots      │  │  🔥 Growth: +2.34%                 │ │
│  │   • Neighbors visible    │  │  💰 Vault: 2,450 IxC  🔥 7d       │ │
│  │   [interactive pan/zoom] │  │  ─────────────────────────────      │ │
│  │                         │  │  🌐 Region · 🏛️ Gov Type           │ │
│  └──────────────────────────┘  └────────────────────────────────────┘ │
│  [Overview] [Executive] [Diplomacy] [Intelligence] [Defense]          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─ LEFT ─────────┐ ┌───── CENTER FEED ──────────┐ ┌─ RIGHT ────────┐│
│  │ (sticky, w-48) │ │                            │ │ (sticky)       ││
│  │ GDP/Pop bars   │ │ ┌── Snapshot Cards ───────┐ │ │ 🔥 Trending   ││
│  │ (toggleable)   │ │ │ Inbox │ Events │ Diplo │ │ │ (5 items)     ││
│  │                │ │ │ Stability              │ │ │                ││
│  │ Vault Mini     │ │ └────────────────────────┘ │ │ 🌍 Countries   ││
│  │ (balance +     │ │                            │ │ to Explore     ││
│  │  streak +      │ │ ┌── Tab Bar ────────────┐  │ │ (3 + Follow)   ││
│  │  claim)        │ │ │ All │ Fol │ Comm │    │  │ │                ││
│  │                │ │ └───────────────────────┘  │ │ ✍️ Blurb of   ││
│  │ ⚠️ Active      │ │                            │ │ the Day        ││
│  │ Crises         │ │ ┌── Composer ───────────┐  │ │                ││
│  │ (count+latest) │ │ │ What's happening...   │  │ │ 📊 Economic   ││
│  │                │ │ └───────────────────────┘  │ │ Tiers          ││
│  │ 📋 Quick Nav   │ │                            │ │                ││
│  │ (Overview/     │ │ ┌── Feed ─────────────────┐│ │                ││
│  │  Exec/Diplo/   │ │ │ Activity items stream  ││ │                ││
│  │  Intel/Defense)│ │ │                        ││ │                ││
│  └────────────────┘ └──────────────────────────┘└──────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### Files & Changes

| File | Changes |
|------|---------|
| `docs/DASHBOARD_2_0_PLAN.md` | This plan |
| `src/server/api/routers/countries/list.ts` | Add `getRandomCountries` endpoint |
| `src/components/dashboard/DashboardPlayerWidget.tsx` | Add GDP/Pop toggle bars, vault mini, active crises. Shrink to w-48. Remove map. |
| `src/components/dashboard/DashboardSidebarLayout.tsx` | Pass hero section through to layout |
| `src/components/dashboard/DashboardRouter.tsx` | Build hero section, pass to layout |
| `src/components/dashboard/sections/UnifiedDashboardSection.tsx` | Grid 5→3, compact trending, Countries to Explore, Blurb of the Day |

### New Backend Endpoint: `countries.getRandomCountries`

- Input: `{ limit?: number }` (default 3, max 10)
- Returns: `{ id, name, slug, flagUrl, economicTier, currentPopulation, continent }[]`
- Uses Prisma randomized ordering
- No caching (want fresh random each time)

### New Left Sidebar Widgets

**GDP/Pop Toggle Bars** (replaces hidden vitality system):
- Bar 1 (Economic): Default GDP/capita. Click toggles: GDP/cap → Total GDP → Growth Rate
- Bar 2 (Demographic): Default Population. Click toggles: Pop → Pop Growth → Density

**Vault Mini**:
- Balance + vault level + streak + [Claim Daily] button
- Uses `vault.getBalance` + `vault.claimDailyBonus`

**Active Crises**:
- Only shown when crises exist
- Count + latest crisis name

### New Right Sidebar Widgets

**Compact Trending**:
- 5 items (was 6-7), smaller padding, no engagement metadata, no settings gear

**Countries to Explore**:
- 3 random countries with flag, name, tier, Follow button
- Links to profile on name click
- "Explore all" link at bottom

**Blurb of the Day**:
- Current active prompt, response count, "Write Response" CTA

### Hero Section

- Interactive `CountryMapEmbed` (h-52) with neighbors
- At-a-glance stat panel alongside
- Quick nav pills below
- Collapsible with localStorage persistence
