# Pack Opening System - Documentation

Cinematic 4-stage pack opening animation system for IxCards trading card platform.

## Overview

The pack opening system provides an immersive, cinematic experience for opening card packs with:
- 4-stage animation pipeline (reveal → explosion → cardReveal → actions)
- Particle system effects (50 particles desktop, 25 mobile)
- Rarity-based sound effects and haptic feedback
- GPU-accelerated animations (60fps target)
- Full tRPC integration with existing card-packs API

## Components

### PackOpeningSequence (Main Orchestrator)
**File**: `PackOpeningSequence.tsx`

Main component that coordinates the entire pack opening flow.

```tsx
import { PackOpeningSequence } from "~/components/cards/pack-opening";

<PackOpeningSequence
  userPackId="clx123..." // UserPack ID from database
  packType="PREMIUM"
  packArtwork="/images/packs/premium.png"
  onComplete={() => {
    // Handle completion (redirect, show rewards, etc.)
  }}
  onCancel={() => {
    // Handle cancellation (return to pack list)
  }}
/>
```

**Props**:
- `userPackId` - ID of user's purchased pack (from UserPack model)
- `packType` - Type of pack (BASIC, PREMIUM, ELITE, etc.)
- `packArtwork` - Optional custom artwork URL
- `onComplete` - Callback when sequence finishes
- `onCancel` - Callback for early exit

**Features**:
- Automatic API call to open pack
- State machine for stage progression
- Error handling with user-friendly messages
- Loading states during API calls

### PackPurchaseModal
**File**: `PackPurchaseModal.tsx`

Pre-purchase confirmation modal with balance checking.

```tsx
import { PackPurchaseModal } from "~/components/cards/pack-opening";

<PackPurchaseModal
  packId="clx456..."
  packType="PREMIUM"
  packName="Premium Pack"
  packDescription="Better odds for rare cards"
  priceCredits={500}
  cardCount={5}
  isOpen={showModal}
  onPurchase={(userPackId) => {
    // Open pack opening sequence with userPackId
  }}
  onCancel={() => setShowModal(false)}
/>
```

**Props**:
- `packId` - CardPack ID from database
- `packType` - Type of pack
- `packName` - Display name
- `packDescription` - Optional description
- `packArtwork` - Optional artwork URL
- `priceCredits` - Price in IxCredits
- `cardCount` - Number of cards in pack
- `isOpen` - Modal visibility control
- `onPurchase` - Callback with userPackId after purchase
- `onCancel` - Callback to close modal

**Features**:
- Real-time balance checking (vault API)
- Insufficient funds warning
- Purchase confirmation with balance preview
- Error handling for failed purchases

### Individual Stage Components

#### Stage1_PackReveal
3D pack appearance with rotation animation.

**Duration**: 2 seconds
**Features**:
- 360° rotation animation
- Pulsing glow effect (pack type-specific colors)
- "Tap to open" instruction
- Floating particles around pack

#### Stage2_PackExplosion
Particle burst and cards flying out.

**Duration**: 800ms
**Features**:
- 50 particles (desktop) / 25 particles (mobile)
- Cards fly out in arc pattern
- Flash effect on explosion
- Radial burst lines
- GPU-accelerated transforms

#### Stage3_CardReveal
Sequential card flip reveals.

**Duration**: ~4 seconds (5 cards × 800ms stagger)
**Features**:
- 3D flip animation (600ms per card)
- Sequential stagger (800ms delay between cards)
- Rarity-based sound effects
- Color glow flash on reveal
- Progress indicator dots

#### Stage4_QuickActions
Post-reveal action interface.

**Duration**: User-controlled
**Features**:
- Junk/Keep/List buttons per card
- Bulk selection mode
- Quick sell estimates (IC value)
- "Collect All" auto-option
- Estimated total value display

## Service Layer

### PackOpeningService
**File**: `src/lib/pack-opening-service.ts`

Utility service for sound, haptic, and particle generation.

```typescript
import { getPackOpeningService } from "~/lib/pack-opening-service";

const service = getPackOpeningService();

// Play rarity sound
service.playRaritySound("LEGENDARY");

// Trigger haptic feedback
service.triggerHaptic("heavy"); // light, medium, heavy

// Generate particles for explosion
const particles = service.generateParticles(50);

// Get rarity color
const color = service.getRarityColor("EPIC");

// Cleanup
service.cleanup();
```

**Methods**:
- `preloadSounds()` - Preload audio files for instant playback
- `playRaritySound(rarity)` - Play rarity-specific reveal sound
- `playPackOpenSound()` - Play pack opening explosion sound
- `triggerHaptic(pattern)` - Vibrate mobile device (feature detection)
- `generateParticles(count)` - Generate particle data for explosion
- `getRarityColor(rarity)` - Get color hex for rarity
- `cleanup()` - Cleanup audio resources

**Singleton Pattern**: Use `getPackOpeningService()` to get shared instance.

## Type Definitions

**File**: `src/types/pack-opening.ts`

```typescript
// Animation stages
type PackOpeningStage = "reveal" | "explosion" | "cardReveal" | "actions";

// Card instance (minimal data for animation)
interface CardInstance {
  id: string;
  name?: string;
  title?: string;
  rarity: CardRarity;
  cardType: string;
  artwork: string;
  season: number;
}

// Quick action types
type QuickActionType = "junk" | "keep" | "list" | "collect";

// Action event
interface QuickActionEvent {
  cardId: string;
  action: QuickActionType;
}

// Haptic patterns
type HapticPattern = "light" | "medium" | "heavy";

// Particle data
interface Particle {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  color: string;
  size: number;
}
```

## Integration Guide

### Step 1: Install in Pack Store Page

```tsx
// app/myvault/packs/page.tsx
"use client";

import { useState } from "react";
import { PackPurchaseModal, PackOpeningSequence } from "~/components/cards/pack-opening";
import { api } from "~/trpc/react";

export default function PackStorePage() {
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<PackData | null>(null);
  const [openingPack, setOpeningPack] = useState<string | null>(null);

  const { data } = api.cardPacks.getAvailablePacks.useQuery();

  return (
    <div>
      {/* Pack grid */}
      {data?.packs.map((pack) => (
        <button
          key={pack.id}
          onClick={() => {
            setSelectedPack(pack);
            setPurchaseModalOpen(true);
          }}
        >
          {pack.name}
        </button>
      ))}

      {/* Purchase modal */}
      {selectedPack && (
        <PackPurchaseModal
          packId={selectedPack.id}
          packType={selectedPack.packType}
          packName={selectedPack.name}
          packDescription={selectedPack.description}
          priceCredits={selectedPack.priceCredits}
          cardCount={selectedPack.cardCount}
          isOpen={purchaseModalOpen}
          onPurchase={(userPackId) => {
            setPurchaseModalOpen(false);
            setOpeningPack(userPackId);
          }}
          onCancel={() => setPurchaseModalOpen(false)}
        />
      )}

      {/* Pack opening sequence (fullscreen) */}
      {openingPack && selectedPack && (
        <div className="fixed inset-0 z-50">
          <PackOpeningSequence
            userPackId={openingPack}
            packType={selectedPack.packType}
            packArtwork={selectedPack.artwork}
            onComplete={() => {
              setOpeningPack(null);
              // Optional: Show success message, refresh pack list
            }}
            onCancel={() => {
              setOpeningPack(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
```

### Step 2: Sound Assets

Place sound files in `public/sounds/`:
- `pack-open.mp3` - Explosion sound
- `common-reveal.mp3` - Common/uncommon card reveal
- `rare-reveal.mp3` - Rare/ultra-rare card reveal
- `legendary-reveal.mp3` - Epic/legendary card reveal

**Note**: System gracefully handles missing sound files with silent fallback.

### Step 3: Pack Artwork

Place pack artwork in `public/images/packs/`:
- `basic-pack.png`
- `premium-pack.png`
- `elite-pack.png`
- `themed-pack.png`
- `seasonal-pack.png`
- `event-pack.png`

**Fallback**: Components show pack type text if artwork missing.

## API Integration

The system integrates with existing tRPC routers:

### cardPacks.openPack
```typescript
// Automatically called by PackOpeningSequence
const cards = await api.cardPacks.openPack.mutate({
  userPackId: "clx123..."
});
```

**Response**:
```typescript
{
  success: true,
  message: "Opened pack and received 5 cards!",
  cards: [
    {
      id: "clx789...",
      name: "Ancient Artifact",
      rarity: "LEGENDARY",
      cardType: "ARTIFACT",
      artwork: "https://...",
      season: 1
    },
    // ... more cards
  ]
}
```

### vault.getVaultBalance
```typescript
// Called by PackPurchaseModal
const balance = await api.vault.getVaultBalance.query();
```

## Performance Optimizations

1. **React.memo** - All components memoized to prevent re-renders
2. **GPU Acceleration** - Uses `transform` and `opacity` only (no layout changes)
3. **Particle Count** - Reduces from 50 to 25 on mobile (detected via window.innerWidth)
4. **Sound Preloading** - Audio files preloaded on service initialization
5. **will-change CSS** - Applied to animated elements for GPU layering
6. **AnimatePresence** - Smooth stage transitions without layout thrashing

## Mobile Optimization

- **Reduced Particles**: 25 instead of 50
- **Haptic Feedback**: Uses navigator.vibrate API (feature detection)
- **Touch Events**: All "tap to open" uses both click and keyboard
- **Responsive Design**: Cards scale down on smaller screens
- **Performance**: 60fps maintained on modern mobile devices

## Accessibility

- **Keyboard Navigation**: All interactive elements support Enter/Space
- **ARIA Labels**: Proper labels on buttons and interactive elements
- **Focus Management**: Visible focus indicators
- **Screen Readers**: Semantic HTML with descriptive text
- **Motion Sensitivity**: Consider adding reduced-motion media query support

## Future Enhancements

### Quick Actions Integration
Currently, quick actions log to console. Integrate with:
```typescript
// In Stage4_QuickActions
const handleQuickAction = (event: QuickActionEvent) => {
  switch (event.action) {
    case "junk":
      api.cards.markAsJunk.mutate({ cardId: event.cardId });
      break;
    case "keep":
      api.cards.addToCollection.mutate({ cardId: event.cardId });
      break;
    case "list":
      api.marketplace.createListing.mutate({ cardId: event.cardId });
      break;
  }
};
```

### Card Display Component
Integrate with Agent 1's CardDisplay component:
```tsx
import { CardDisplay } from "~/components/cards/display";

// In Stage3_CardReveal or Stage4_QuickActions
<CardDisplay
  card={card}
  showStats={true}
  interactive={false}
/>
```

## Troubleshooting

### Issue: No sound playing
- **Check**: Sound files exist in `public/sounds/`
- **Check**: Browser autoplay policy (some browsers block audio until user interaction)
- **Solution**: System gracefully falls back to silent mode

### Issue: Haptic not working
- **Check**: Feature only works on mobile browsers
- **Check**: Some iOS browsers require user permission
- **Solution**: System silently fails if unsupported

### Issue: Animations laggy
- **Check**: GPU acceleration enabled (inspect with Chrome DevTools)
- **Check**: Particle count (reduce if needed)
- **Solution**: System auto-reduces particles on mobile

### Issue: Pack not opening
- **Check**: Console for API errors
- **Check**: User has purchased pack (UserPack exists)
- **Check**: Pack not already opened
- **Solution**: Error message displays automatically

## Performance Targets

- **Stage 1 Duration**: 2 seconds
- **Stage 2 Duration**: 800ms
- **Stage 3 Duration**: 4 seconds (5 cards)
- **Stage 4 Duration**: User-controlled
- **Total Auto Sequence**: ~7 seconds
- **FPS Target**: 60fps
- **Mobile Particle Count**: 25
- **Desktop Particle Count**: 50

## File Structure

```
src/
├── components/cards/pack-opening/
│   ├── PackOpeningSequence.tsx     # Main orchestrator
│   ├── PackPurchaseModal.tsx       # Purchase confirmation
│   ├── Stage1_PackReveal.tsx       # Pack appearance
│   ├── Stage2_PackExplosion.tsx    # Explosion effect
│   ├── Stage3_CardReveal.tsx       # Card flip sequence
│   ├── Stage4_QuickActions.tsx     # Post-reveal actions
│   ├── index.ts                    # Barrel export
│   └── README.md                   # This file
├── lib/
│   └── pack-opening-service.ts     # Service layer
└── types/
    └── pack-opening.ts             # Type definitions
```

## Dependencies

- `framer-motion` - Animation library (already in project)
- `@prisma/client` - Database types
- `@trpc/client` - API client
- React 18+ - Hooks and concurrent features
- Next.js 15 - App Router

All dependencies already present in IxStats project.
