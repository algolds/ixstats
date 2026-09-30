# Card Display Components - Usage Examples

Usage examples for the card display components.

## Table of Contents

1. [Basic Card Display](#basic-card-display)
2. [Card Details Modal](#card-details-modal)
3. [Advanced Patterns](#advanced-patterns)

> **Updated September 2026:** `CardGrid`, `CardCarousel`, and `CardContainer3D` were removed, and there is no `~/components/cards/display` barrel — import each component from its own file. Examples that depended on the removed components (grid, carousel, full gallery, MyVault page) were dropped; see `README.md` for a gallery example and `src/components/vault/sections/cards/InventoryTab.tsx` for the live implementation.

---

## Basic Card Display

### Single Card

```tsx
import { CardDisplay } from "~/components/cards/display/CardDisplay";
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

### Different Sizes

```tsx
import { CardDisplay } from "~/components/cards/display/CardDisplay";

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

## Card Details Modal

### Basic Modal

```tsx
"use client";

import { useState } from "react";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
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
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";

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

  const handleTrade = (card: CardInstance) => {
    // P2P trades live in the Vault marketplace (trading.createtradeOffer)
    router.push("/vault/marketplace?tab=trading");
  };

  const handleList = (card: CardInstance) => {
    // Auctions are created via cardMarket.createAuction (CreateAuctionModal)
    router.push("/vault/marketplace?tab=auctions");
  };

  const handleViewCollection = (countryId: string) => {
    router.push(`/countries/${countryId}`); // no per-country card collection route exists
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

## Advanced Patterns

### Card Comparison View

`CardDetailsModal` already ships a compare tab (`comparisonCard` prop). For a custom layout, `StatsComparison` below is a placeholder for your own component:

```tsx
import { CardDisplay } from "~/components/cards/display/CardDisplay";

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
import { motion } from "motion/react";
import { CardDisplay } from "~/components/cards/display/CardDisplay";

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

**Note**: All examples assume the tRPC API and the app auth context (`~/context/auth-context`) are set up.
