# Card Display Components - Usage Examples

Complete usage examples for all card display components.

## Table of Contents

1. [Basic Card Display](#basic-card-display)
2. [Card Grid with Infinite Scroll](#card-grid-with-infinite-scroll)
3. [Featured Card Carousel](#featured-card-carousel)
4. [Card Details Modal](#card-details-modal)
5. [Complete Gallery Page](#complete-gallery-page)
6. [MyVault Integration](#myvault-integration)

---

## Basic Card Display

### Single Card

```tsx
import { CardDisplay } from "~/components/cards/display";
import type { CardInstance } from "~/types/cards-display";

export function SingleCard({ card }: { card: CardInstance }) {
  return (
    <CardDisplay
      card={card}
      size="medium"
      onClick={(card) => console.log("Clicked:", card.title)}
      showStatsOnHover
      enable3D
    />
  );
}
```

### Card with 3D Container

```tsx
import { CardDisplay, CardContainer3D } from "~/components/cards/display";

export function Enhanced3DCard({ card }: { card: CardInstance }) {
  return (
    <CardContainer3D intensity={0.7} enabled>
      <CardDisplay
        card={card}
        size="large"
        showStatsOnHover
        enable3D={false} // Disable CardDisplay's 3D since Container handles it
      />
    </CardContainer3D>
  );
}
```

### Different Sizes

```tsx
import { CardDisplay } from "~/components/cards/display";

export function CardSizeDemo({ card }: { card: CardInstance }) {
  return (
    <div className="flex gap-4 items-end">
      <CardDisplay card={card} size="small" />
      <CardDisplay card={card} size="medium" />
      <CardDisplay card={card} size="large" />
    </div>
  );
}
```

---

## Card Grid with Infinite Scroll

### Basic Grid

```tsx
"use client";

import { useState } from "react";
import { CardGrid } from "~/components/cards/display";
import { api } from "~/trpc/react";

export function CardGallery() {
  const { data, fetchNextPage, hasNextPage, isLoading } =
    api.cards.getCards.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) =>
          lastPage.hasMore ? lastPage.offset + 20 : undefined,
      }
    );

  const cards = data?.pages.flatMap((page) => page.cards) ?? [];

  return (
    <CardGrid
      cards={cards}
      loading={isLoading}
      hasMore={hasNextPage ?? false}
      onLoadMore={() => fetchNextPage()}
      cardSize="medium"
    />
  );
}
```

### Grid with Filters

```tsx
"use client";

import { useState } from "react";
import { CardGrid } from "~/components/cards/display";
import { CardRarity } from "@prisma/client";
import type { CardFilters, CardSort } from "~/types/cards-display";

export function FilterableCardGrid() {
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<CardSort>("rarity");

  const { data, fetchNextPage, hasNextPage, isLoading } =
    api.cards.getCards.useInfiniteQuery({
      limit: 20,
      ...filters,
    });

  const cards = data?.pages.flatMap((page) => page.cards) ?? [];

  return (
    <div className="space-y-6">
      {/* Filter controls */}
      <div className="flex gap-4">
        <select
          onChange={(e) =>
            setFilters({ ...filters, rarity: e.target.value as CardRarity })
          }
          className="glass-hierarchy-interactive px-4 py-2 rounded-lg"
        >
          <option value="">All Rarities</option>
          <option value={CardRarity.COMMON}>Common</option>
          <option value={CardRarity.RARE}>Rare</option>
          <option value={CardRarity.LEGENDARY}>Legendary</option>
        </select>

        <select
          onChange={(e) => setSort(e.target.value as CardSort)}
          className="glass-hierarchy-interactive px-4 py-2 rounded-lg"
        >
          <option value="rarity">Rarity</option>
          <option value="value">Market Value</option>
          <option value="acquired">Recently Acquired</option>
        </select>
      </div>

      {/* Card grid */}
      <CardGrid
        cards={cards}
        loading={isLoading}
        hasMore={hasNextPage ?? false}
        onLoadMore={() => fetchNextPage()}
        filters={filters}
        sort={sort}
        cardSize="medium"
      />
    </div>
  );
}
```

---

## Featured Card Carousel

### Auto-playing Carousel

```tsx
import { CardCarousel } from "~/components/cards/display";
import { api } from "~/trpc/react";

export function FeaturedCarousel() {
  const { data: featuredCards } = api.cards.getFeaturedCards.useQuery({
    limit: 10,
  });

  if (!featuredCards || featuredCards.length === 0) return null;

  return (
    <section className="py-8">
      <h2 className="text-3xl font-bold text-white mb-6">
        Featured Cards
      </h2>
      <CardCarousel
        cards={featuredCards}
        autoPlay
        interval={5000}
        cardSize="large"
        showNavigation
      />
    </section>
  );
}
```

### Manual Navigation Carousel

```tsx
import { CardCarousel } from "~/components/cards/display";

export function ManualCarousel({ cards }: { cards: CardInstance[] }) {
  return (
    <CardCarousel
      cards={cards}
      autoPlay={false}
      cardSize="medium"
      showNavigation
      onCardClick={(card) => console.log("Card clicked:", card)}
    />
  );
}
```

---

## Card Details Modal

### Basic Modal

```tsx
"use client";

import { useState } from "react";
import { CardDisplay, CardDetailsModal } from "~/components/cards/display";
import type { CardInstance } from "~/types/cards-display";

export function CardWithModal({ card }: { card: CardInstance }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <CardDisplay
        card={card}
        size="medium"
        onClick={() => setIsOpen(true)}
      />

      <CardDetailsModal
        card={card}
        open={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
```

### Modal with Actions

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardDetailsModal } from "~/components/cards/display";
import { api } from "~/trpc/react";

export function InteractiveCardModal({
  card,
  open,
  onClose
}: {
  card: CardInstance | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const transferMutation = api.cards.transferCard.useMutation();

  const handleTrade = (card: CardInstance) => {
    // Open trade modal
    console.log("Opening trade for:", card.title);
  };

  const handleList = (card: CardInstance) => {
    // Open market listing modal
    console.log("Listing card:", card.title);
  };

  const handleViewCollection = (countryId: string) => {
    router.push(`/cards/collection/${countryId}`);
  };

  return (
    <CardDetailsModal
      card={card}
      open={open}
      onClose={onClose}
      onTrade={handleTrade}
      onList={handleList}
      onViewCollection={handleViewCollection}
    />
  );
}
```

---

## Complete Gallery Page

### Full-Featured Gallery

```tsx
"use client";

import { useState } from "react";
import { CardGrid, CardCarousel, CardDetailsModal } from "~/components/cards/display";
import { CardRarity, CardType } from "@prisma/client";
import { api } from "~/trpc/react";
import type { CardInstance, CardFilters } from "~/types/cards-display";

export default function CardGalleryPage() {
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const [filters, setFilters] = useState<CardFilters>({});

  // Fetch featured cards
  const { data: featuredCards } = api.cards.getFeaturedCards.useQuery({
    limit: 10,
  });

  // Fetch all cards with infinite scroll
  const { data, fetchNextPage, hasNextPage, isLoading } =
    api.cards.getCards.useInfiniteQuery(
      { limit: 24, ...filters },
      {
        getNextPageParam: (lastPage) =>
          lastPage.hasMore ? lastPage.offset + 24 : undefined,
      }
    );

  const cards = data?.pages.flatMap((page) => page.cards) ?? [];

  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      {/* Page header */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-white">
          Card Gallery
        </h1>
        <p className="text-lg text-white/70">
          Explore the complete collection of IxCards
        </p>
      </div>

      {/* Featured carousel */}
      {featuredCards && featuredCards.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Featured Cards
          </h2>
          <CardCarousel
            cards={featuredCards}
            autoPlay
            interval={5000}
            cardSize="large"
            onCardClick={setSelectedCard}
          />
        </section>
      )}

      {/* Filters */}
      <section className="glass-hierarchy-child rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-2">
              Rarity
            </label>
            <select
              onChange={(e) =>
                setFilters({
                  ...filters,
                  rarity: e.target.value ? e.target.value as CardRarity : undefined
                })
              }
              className="glass-hierarchy-interactive w-full px-4 py-2 rounded-lg text-white"
            >
              <option value="">All Rarities</option>
              <option value={CardRarity.COMMON}>Common</option>
              <option value={CardRarity.UNCOMMON}>Uncommon</option>
              <option value={CardRarity.RARE}>Rare</option>
              <option value={CardRarity.ULTRA_RARE}>Ultra Rare</option>
              <option value={CardRarity.EPIC}>Epic</option>
              <option value={CardRarity.LEGENDARY}>Legendary</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">
              Type
            </label>
            <select
              onChange={(e) =>
                setFilters({
                  ...filters,
                  type: e.target.value ? e.target.value as CardType : undefined
                })
              }
              className="glass-hierarchy-interactive w-full px-4 py-2 rounded-lg text-white"
            >
              <option value="">All Types</option>
              <option value={CardType.NATION}>Nation</option>
              <option value={CardType.LORE}>Lore</option>
              <option value={CardType.NS_IMPORT}>NS Import</option>
              <option value={CardType.SPECIAL}>Special</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">
              Search
            </label>
            <input
              type="text"
              placeholder="Search cards..."
              onChange={(e) =>
                setFilters({
                  ...filters,
                  search: e.target.value || undefined
                })
              }
              className="glass-hierarchy-interactive w-full px-4 py-2 rounded-lg text-white placeholder:text-white/40"
            />
          </div>
        </div>
      </section>

      {/* Card grid */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">
          All Cards
        </h2>
        <CardGrid
          cards={cards}
          loading={isLoading}
          hasMore={hasNextPage ?? false}
          onLoadMore={() => fetchNextPage()}
          filters={filters}
          cardSize="medium"
          onCardClick={setSelectedCard}
          emptyMessage="No cards match your filters"
        />
      </section>

      {/* Card details modal */}
      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}
```

---

## MyVault Integration

### User's Card Collection

```tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CardGrid, CardDetailsModal } from "~/components/cards/display";
import { api } from "~/trpc/react";
import type { CardInstance } from "~/types/cards-display";

export function MyCardCollection() {
  const { user } = useUser();
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const [sortBy, setSortBy] = useState<"rarity" | "acquired" | "value">("rarity");

  const { data: ownerships, isLoading } = api.cards.getMyCards.useQuery({
    sortBy,
  });

  // Extract cards from ownerships
  const cards = ownerships?.map(o => o.card) ?? [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-hierarchy-child rounded-xl p-4">
          <div className="text-sm text-white/70">Total Cards</div>
          <div className="text-3xl font-bold text-white">
            {ownerships?.reduce((sum, o) => sum + o.quantity, 0) ?? 0}
          </div>
        </div>
        <div className="glass-hierarchy-child rounded-xl p-4">
          <div className="text-sm text-white/70">Unique Cards</div>
          <div className="text-3xl font-bold text-white">
            {ownerships?.length ?? 0}
          </div>
        </div>
        <div className="glass-hierarchy-child rounded-xl p-4">
          <div className="text-sm text-white/70">Collection Value</div>
          <div className="text-3xl font-bold text-amber-400">
            {ownerships?.reduce((sum, o) =>
              sum + (o.card.marketValue * o.quantity), 0
            ).toFixed(0) ?? 0} IX
          </div>
        </div>
      </div>

      {/* Sort */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">
          My Collection
        </h2>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="glass-hierarchy-interactive px-4 py-2 rounded-lg text-white"
        >
          <option value="rarity">Sort by Rarity</option>
          <option value="value">Sort by Value</option>
          <option value="acquired">Recently Acquired</option>
        </select>
      </div>

      {/* Grid */}
      <CardGrid
        cards={cards}
        loading={isLoading}
        cardSize="medium"
        onCardClick={setSelectedCard}
        emptyMessage="You don't have any cards yet"
      />

      {/* Details modal */}
      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}
```

---

## Advanced Patterns

### Card Comparison View

```tsx
import { CardDisplay } from "~/components/cards/display";

export function CardComparison({
  card1,
  card2
}: {
  card1: CardInstance;
  card2: CardInstance;
}) {
  return (
    <div className="grid grid-cols-2 gap-8">
      <div className="space-y-4">
        <CardDisplay card={card1} size="large" />
        <StatsComparison card={card1} highlight={card1} compare={card2} />
      </div>
      <div className="space-y-4">
        <CardDisplay card={card2} size="large" />
        <StatsComparison card={card2} highlight={card2} compare={card1} />
      </div>
    </div>
  );
}
```

### Animated Card Reveal

```tsx
import { motion } from "framer-motion";
import { CardDisplay } from "~/components/cards/display";

export function CardReveal({ card }: { card: CardInstance }) {
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <CardDisplay card={card} size="large" />
    </motion.div>
  );
}
```

---

**Note**: All examples assume you have the tRPC API setup and Clerk authentication configured.
