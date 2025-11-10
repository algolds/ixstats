# Card Display Components

Premium trading card display components with glass physics integration for the IxCards system.

## Overview

This directory contains all card display components built for Phase 1 of the IxCards implementation. These components feature:

- **Glass Physics Integration**: All components follow the IxStats glass physics depth hierarchy
- **3D Effects**: Holographic parallax and mouse-tracked tilt effects
- **Rarity System**: Color-coded displays with glow effects for 6 rarity tiers
- **Performance**: GPU-accelerated animations, lazy loading, React.memo optimization
- **Accessibility**: ARIA labels, keyboard navigation support

## Components

### CardDisplay

Individual trading card component with holographic parallax effects.

**Features:**
- Uses CometCard for 3D tilt and holographic effects
- Rarity-based glow colors (Common → Legendary)
- Stats reveal on hover
- 3 size variants: small (w-32), medium (w-48), large (w-64)
- Lazy-loaded images with Next.js Image
- Glass hierarchy child/interactive levels

**Usage:**
```tsx
import { CardDisplay } from "~/components/cards/display";

<CardDisplay
  card={cardInstance}
  size="medium"
  onClick={(card) => handleCardClick(card)}
  showStatsOnHover
/>
```

**Props:**
- `card` (CardInstance): Card data
- `size` (CardDisplaySize): "small" | "medium" | "large"
- `onClick` ((card) => void): Click handler
- `className` (string): Additional CSS classes
- `showStatsOnHover` (boolean): Show stats on hover (default: true)
- `enable3D` (boolean): Enable 3D tilt (default: true)

### CardGrid

Responsive grid layout with infinite scroll pagination.

**Features:**
- CSS Grid masonry layout
- Infinite scroll with Intersection Observer
- Loading skeletons with glass effects
- Filter/sort integration
- Staggered entrance animations
- Empty state handling

**Usage:**
```tsx
import { CardGrid } from "~/components/cards/display";

<CardGrid
  cards={cardData}
  loading={isLoading}
  hasMore={hasMore}
  onLoadMore={fetchMoreCards}
  onCardClick={handleCardClick}
  cardSize="medium"
/>
```

**Props:**
- `cards` (CardInstance[]): Array of cards
- `loading` (boolean): Loading state
- `error` (string | null): Error message
- `onLoadMore` (() => void): Load more handler
- `hasMore` (boolean): More cards available
- `filters` (CardFilters): Active filters
- `sort` (CardSort): Sort option
- `cardSize` (CardDisplaySize): Card size
- `onCardClick` ((card) => void): Card click handler
- `className` (string): Additional classes
- `emptyMessage` (string): Empty state message

### CardCarousel

Apple-style horizontal carousel for featured cards.

**Features:**
- Smooth momentum scrolling
- Auto-play with interval control
- Navigation arrows
- Indicator dots
- Pause on hover
- Responsive spacing

**Usage:**
```tsx
import { CardCarousel } from "~/components/cards/display";

<CardCarousel
  cards={featuredCards}
  autoPlay
  interval={5000}
  onCardClick={handleCardClick}
  showNavigation
/>
```

**Props:**
- `cards` (CardInstance[]): Cards to display
- `cardSize` (CardDisplaySize): Card size
- `autoPlay` (boolean): Enable auto-play
- `interval` (number): Auto-play interval in ms
- `onCardClick` ((card) => void): Card click handler
- `className` (string): Additional classes
- `showNavigation` (boolean): Show nav arrows

### CardDetailsModal

Expanded card view with full stats and market data.

**Features:**
- Full card stats display (all 4 attributes)
- Market history chart (placeholder)
- Ownership information
- Quick actions (Trade, List, View Collection)
- Glass modal depth level
- Responsive 2-column layout

**Usage:**
```tsx
import { CardDetailsModal } from "~/components/cards/display";

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

### CardContainer3D

3D perspective wrapper with mouse tracking.

**Features:**
- Mouse-tracked tilt effect
- Configurable intensity (0-1)
- GPU-accelerated transforms
- Smooth spring animations
- Depth shadows

**Usage:**
```tsx
import { CardContainer3D } from "~/components/cards/display";

<CardContainer3D intensity={0.7} enabled>
  <CardDisplay card={card} />
</CardContainer3D>
```

**Props:**
- `children` (ReactNode): Content to wrap
- `intensity` (number): Tilt intensity 0-1 (default: 0.5)
- `enabled` (boolean): Enable effect (default: true)
- `className` (string): Additional classes

### RarityBadge

Animated rarity indicator with shimmer effects.

**Features:**
- Color-coded by rarity tier
- Shimmer effect for rare+ cards
- Rainbow pulse for Legendary
- Pulse animation on hover
- 3 size variants

**Usage:**
```tsx
import { RarityBadge } from "~/components/cards/display";

<RarityBadge
  rarity={CardRarity.LEGENDARY}
  size="medium"
  animated
/>
```

**Props:**
- `rarity` (CardRarity): Rarity tier
- `size` ("small" | "medium" | "large"): Badge size
- `animated` (boolean): Enable animations (default: true)
- `className` (string): Additional classes

## Utilities

### card-display-utils.ts

Helper functions for card display logic.

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
- `CardDisplaySize`: "small" | "medium" | "large"
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

## Glass Physics Integration

All components use the IxStats glass physics hierarchy:

- **CardDisplay**: `glass-hierarchy-child` (cards)
- **CardGrid skeletons**: `glass-hierarchy-child` (loading states)
- **CardDetailsModal**: `glass-modal` (modal level)
- **Interactive buttons**: `glass-hierarchy-interactive` (buttons, navigation)

## Performance Optimizations

1. **React.memo**: All components memoized
2. **Lazy Loading**: Images use `loading="lazy"`
3. **GPU Acceleration**: Transform and opacity animations only
4. **Intersection Observer**: Efficient infinite scroll
5. **Debouncing**: Auto-play and scroll handlers

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
import { CardGrid, CardDetailsModal } from "~/components/cards/display";
import { api } from "~/trpc/react";

export default function CardGallery() {
  const [selectedCard, setSelectedCard] = useState(null);
  const { data, fetchNextPage, hasNextPage } = api.cards.getCards.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const cards = data?.pages.flatMap((page) => page.cards) ?? [];

  return (
    <>
      <CardGrid
        cards={cards}
        hasMore={hasNextPage}
        onLoadMore={fetchNextPage}
        onCardClick={setSelectedCard}
      />
      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </>
  );
}
```

### Featured Carousel

```tsx
import { CardCarousel } from "~/components/cards/display";

export function FeaturedCards({ cards }) {
  return (
    <section>
      <h2>Featured Cards</h2>
      <CardCarousel
        cards={cards}
        autoPlay
        interval={5000}
        cardSize="large"
      />
    </section>
  );
}
```

## File Structure

```
src/components/cards/display/
├── CardDisplay.tsx          # Main card component
├── CardGrid.tsx             # Grid layout with infinite scroll
├── CardCarousel.tsx         # Horizontal carousel
├── CardDetailsModal.tsx     # Expanded card view
├── CardContainer3D.tsx      # 3D wrapper
├── RarityBadge.tsx          # Rarity indicator
├── index.ts                 # Barrel export
└── README.md                # This file

src/lib/
└── card-display-utils.ts    # Display utilities

src/types/
└── cards-display.ts         # Type definitions
```

## Dependencies

- `framer-motion`: Animations
- `next/image`: Optimized images
- `@radix-ui/react-dialog`: Modal primitives
- `lucide-react`: Icons
- `tailwindcss`: Styling
- `@prisma/client`: Card enums

## Notes

- Card data structure defined in `/prisma/schema.prisma`
- Existing card APIs in `/src/server/api/routers/cards.ts`
- Glass physics classes defined in Tailwind config
- All animations respect `prefers-reduced-motion`

## Next Steps (Other Agents)

These components will be used by:
- **Agent 2**: Sound effects on card interactions
- **Agent 3**: Pack opening animations
- **Agent 4**: Real-time updates via WebSocket

---

**Created**: November 2025
**Phase**: IxCards Phase 1 - Card Display Components
**Status**: Complete
