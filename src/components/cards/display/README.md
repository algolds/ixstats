# Card Display Components

Premium trading card display components with Facet (glass) integration for the IxCards system.

## Overview

This directory contains the card display components for IxCards (originally Phase 1, since extended by the lore-first rebuild). There is no barrel `index.ts` — import each component from its own file. These components feature:

- **Facet Integration**: All components follow the IxStats Facet (glass) depth hierarchy
- **3D Effects**: Holographic parallax and mouse-tracked tilt effects
- **Rarity System**: Color-coded displays with glow effects for 6 rarity tiers
- **Performance**: GPU-accelerated animations, lazy loading, React.memo optimization
- **Accessibility**: ARIA labels, keyboard navigation support

## Components

### CardDisplay

Individual trading card component with holographic parallax effects.

**Features:**
- Uses CometCard for 3D tilt and holographic effects
- Category-themed face (`getCategoryTheme`, `CategoryIcon`) and hybrid rarity materials (`getHybridRarityMaterial`)
- Stats reveal on hover (unless `hideStats`)
- Size variants: `"small" | "sm" | "medium" | "md" | "large"`
- Next.js `Image`, NS artwork via `proxyNSImage()`
- Glass hierarchy child/interactive levels

**Usage:**
```tsx
import { CardDisplay } from "~/components/cards/display/CardDisplay";

<CardDisplay
  card={cardInstance}
  size="medium"
  onClick={(card) => handleCardClick(card)}
  showStatsOnHover
/>
```

**Props:**
- `card` (CardInstance): Card data
- `size` (CardDisplaySize): "small" | "sm" | "medium" | "md" | "large" (default "medium")
- `onClick` ((card) => void): Click handler
- `className` (string): Additional CSS classes
- `showStatsOnHover` (boolean): Show stats on hover (default: true)
- `enable3D` (boolean): Enable 3D tilt (default: true)
- `enableHolographic` (boolean): Holographic effects (default: on for rare+)
- `performanceMode` (boolean): Disable heavy effects (default: false)
- `hideValue` / `hideStats` / `hideExcerpt` (boolean): Hide market value, stat bars, or lore excerpt

### Removed components

`CardGrid`, `CardCarousel`, and `CardContainer3D` no longer exist. Grids are built per-surface (e.g. `src/components/vault/sections/cards/InventoryTab.tsx`, `CardGalleryTab.tsx`); for a standalone 3D inspector use `Card3DViewer.tsx`.

### CardDetailsModal

Expanded card view with full stats, artwork, and market data (tabs decomposed into `src/components/cards/display/modal/`: `CardOverviewTab`, `CardStatsTab`, `CardMarketTab`, `CardLoreTab`, `CardCompareTab`).

**Features:**
- Overview, stats, market (price history), lore (wiki excerpt), and compare tabs
- NationStates attribution footer (`NationStatesAttribution`) with takedown trigger (`CardTakedownVerificationModal`) for NS cards
- Ownership information
- Quick actions (Trade, List, View Collection, Share, Download image)
- Glass modal depth level

**Usage:**
```tsx
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";

<CardDetailsModal
  card={selectedCard}
  open={isOpen}
  onClose={() => setIsOpen(false)}
  onTrade={handleTrade}
  onList={handleList}
  onViewCollection={handleViewCollection}
/>
```

**Props:**
- `card` (CardInstance | null): Card to display
- `open` (boolean): Modal open state
- `onClose` (() => void): Close handler
- `onTrade` ((card) => void): Trade action
- `onList` ((card) => void): List on market
- `onViewCollection` ((countryId) => void): View collection
- `comparisonCard` (CardInstance | null): Pre-selected card for the compare tab
- `onShare` / `onDownloadImage` ((card) => void): Share and image export actions

### NationStatesAttribution

Footer providing compliance attribution for NationStates-imported cards.

**Features:**
- "Data via official NationStates API" attribution with NS logo and disclaimer
- Optional `onRequestTakedown` callback that opens the self-service takedown flow
- Props: `className?`, `onRequestTakedown?`

### Other components

- `Card3DViewer.tsx` – Full 3D viewer with card-back flip (`CardBack.tsx`, variants `lattice` / `zodiac` / `runes`)
- `CardHolographicCover.tsx` / `LoreCardHolographicCover.tsx` – Procedural (Tier 1–2) card faces when no artwork is present
- `HolographicOverlay.tsx` – Rarity foil overlay
- `CardPriceHistoryChart.tsx` – Market history chart (`cardId`)
- `LoreWikiExcerpt.tsx` – Wiki excerpt block for lore cards
- `CardTakedownVerificationModal.tsx` – NS nation-owner takedown dialog
- `NationStatesLogo.tsx`, `IIWikiLogo.tsx` – Source badges

### RarityBadge

Rarity (and optional season) indicator with shimmer effects.

**Features:**
- Color-coded by rarity tier
- Shimmer effect for rare+ cards
- Rainbow pulse for Legendary
- 3 size variants

**Usage:**
```tsx
import { RarityBadge } from "~/components/cards/display/RarityBadge";

<RarityBadge rarity="LEGENDARY" season={2} size="medium" animated />
```

**Props:**
- `rarity` (string): Rarity tier (e.g. "LEGENDARY")
- `season` (number): Optional season number
- `size` ("small" | "medium" | "large"): Badge size
- `animated` (boolean): Enable animations (default: true)
- `className` (string): Additional classes

## Utilities

### `src/lib/cards/display-utils.ts`

Helper functions for card display logic (also `normalizeRarity`, `getRarityHex`, `getRarityTier`, `getCardSerialNumber`, `getCardEditionLabel`, …).

**Functions:**
- `getRarityColor(rarity)`: Get Tailwind color class
- `getRarityGlow(rarity)`: Get glow intensity class
- `getRarityConfig(rarity)`: Get full rarity config
- `formatCardStats(card)`: Format stats for display
- `getCardAspectRatio(size)`: Get aspect ratio class
- `getCardWidth(size)`: Get width class
- `formatMarketValue(value)`: Format IX Points
- `formatSupply(supply)`: Format supply count
- `getShimmerEffect(rarity, animated)`: Get shimmer animation
- `getRarityPercentage(rarity)`: Get rarity percentage
- `getOwnerCount(owners)`: Format owner count
- `isNewCard(date)`: Check if card is new (7 days)
- `getCardTypeLabel(type)`: Get card type label

## Types

### cards-display.ts

TypeScript type definitions.

**Types:**
- `CardDisplaySize`: "small" | "sm" | "medium" | "md" | "large"
- `DiscriminatedCardInstance`: `LoreCardInstance | NSCardInstance | NationCardInstance`
- Branded IDs: `UserId`, `CardId`, `AuctionId`, `OwnershipId`
- `CardInstance`: Complete card data interface
- `FormattedStats`: Display-ready stats
- `MarketHistoryPoint`: Market data point
- `CardFilters`: Filter options
- `CardSort`: Sort options
- `RarityConfig`: Rarity display config

## Rarity System

**6 Tiers with color mappings:**

| Rarity | Color | Glow | Border |
|--------|-------|------|--------|
| Common | Gray | shadow-md | border-gray-500/20 |
| Uncommon | Green | shadow-lg | border-green-500/20 |
| Rare | Blue | shadow-lg | border-blue-500/20 |
| Ultra Rare | Purple | shadow-xl | border-purple-500/20 |
| Epic | Violet | shadow-xl | border-violet-500/20 |
| Legendary | Gold | shadow-2xl + rainbow | border-amber-500/20 |

**Special Effects:**
- Rare+: Shimmer animation
- Legendary: Rainbow pulse animation

## Facet Integration

All components use the IxStats Facet (glass) hierarchy:

- **CardDisplay**: `glass-hierarchy-child` (cards)
- **CardDetailsModal**: `glass-modal` (modal level)
- **Interactive buttons**: `glass-hierarchy-interactive` (buttons, navigation)

## Performance Optimizations

1. **React.memo**: All components memoized
2. **Lazy Loading**: Images use `loading="lazy"`
3. **GPU Acceleration**: Transform and opacity animations only
4. **`performanceMode` prop**: Disables heavy effects for dense grids

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus indicators on buttons
- Semantic HTML structure
- Alt text on all images

## Integration Examples

### Basic Gallery Page

```tsx
"use client";

import { useState } from "react";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";

export function CardGallery({ cards }: { cards: CardInstance[] }) {
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <CardDisplay key={card.id} card={card} size="medium" onClick={setSelectedCard} />
        ))}
      </div>
      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </>
  );
}
```

For a real data source see `api.cards.getMyCards` (ownerships with a nested `cards` definition) and how `src/components/vault/sections/cards/InventoryTab.tsx` maps them to `CardInstance`.

## File Structure

```
src/components/cards/display/
├── CardDisplay.tsx                    # Main card component
├── CardDetailsModal.tsx               # Expanded card view
├── modal/                             # Overview / Stats / Market / Lore / Compare tabs
├── Card3DViewer.tsx, CardBack.tsx     # 3D viewer + card backs
├── CardHolographicCover.tsx, LoreCardHolographicCover.tsx, HolographicOverlay.tsx
├── RarityBadge.tsx
├── CardPriceHistoryChart.tsx, LoreWikiExcerpt.tsx
├── NationStatesAttribution.tsx, CardTakedownVerificationModal.tsx
├── NationStatesLogo.tsx, IIWikiLogo.tsx
├── README.md, USAGE_EXAMPLES.md       # This documentation
└── nationstates-api.md                # Upstream NS API reference copy

src/lib/cards/
└── display-utils.ts                   # Display utilities

src/types/
└── cards-display.ts                   # Type definitions
```

## Dependencies

- `motion` (`motion/react`): Animations
- `next/image`: Optimized images
- `@radix-ui/react-dialog`: Modal primitives
- `iconoir-react`: Icons
- `tailwindcss`: Styling
- `@prisma/client`: Card enums

## Notes

- Card data structure defined in `prisma/schema/cards.prisma`
- Card APIs in `src/server/api/routers/cards/` (plus `card-packs/`, `card-market/`, `lore-cards/`, `ns-import/`)
- Facet (glass) classes defined in Tailwind config

---

**Created**: November 2025 (last verified September 2026)
**Phase**: IxCards Phase 1 - Card Display Components, extended by the 2026-08 lore-first rebuild
**Status**: Complete
