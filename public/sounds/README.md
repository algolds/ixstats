# Sound Assets for IxCards System

This directory contains sound effects for the complete IxCards experience.

## Directory Structure

```
/sounds/
└── cards/
    ├── pack-open.mp3
    ├── card-flip.mp3
    ├── card-hover.mp3
    ├── card-select.mp3
    ├── common-reveal.mp3
    ├── rare-reveal.mp3
    ├── epic-reveal.mp3
    ├── legendary-reveal.mp3
    ├── auction-bid.mp3
    ├── craft-success.mp3
    ├── craft-fail.mp3
    └── trade-complete.mp3
```

## Required Sound Files (All Optional)

The IxCards system gracefully handles missing sound files - all features work silently without them.

### Pack Opening Sounds
- **pack-open.mp3** - Explosion sound when pack bursts open
  - Duration: ~1-2 seconds
  - Format: MP3, 128-256kbps
  - Type: Whoosh/explosion effect
  - Used in: Pack opening sequence (Stage 2)

### Card Interaction Sounds
- **card-flip.mp3** - Generic card flip sound
  - Duration: ~0.3-0.5 seconds
  - Format: MP3, 128-256kbps
  - Type: Quick card flip/whoosh
  - Used in: Card reveals, inventory browsing

- **card-hover.mp3** - Hover over card sound
  - Duration: ~0.1-0.2 seconds
  - Format: MP3, 128-256kbps
  - Type: Subtle hover feedback
  - Used in: CardDisplay hover effects

- **card-select.mp3** - Click/select card sound
  - Duration: ~0.2-0.3 seconds
  - Format: MP3, 128-256kbps
  - Type: Click/selection confirmation
  - Used in: Card selection, modal opening

### Card Reveal Sounds (Rarity-based)
- **common-reveal.mp3** - Common/Uncommon card reveals
  - Duration: ~0.5-1 second
  - Format: MP3, 128-256kbps
  - Type: Soft "ding" or card flip sound
  - Used in: Common/Uncommon rarity reveals

- **rare-reveal.mp3** - Rare/Ultra Rare card reveals
  - Duration: ~0.5-1 second
  - Format: MP3, 128-256kbps
  - Type: Brighter "ding" with shimmer
  - Used in: Rare/Ultra Rare rarity reveals

- **epic-reveal.mp3** - Epic card reveals
  - Duration: ~1-1.5 seconds
  - Format: MP3, 128-256kbps
  - Type: Impressive fanfare
  - Used in: Epic rarity reveals

- **legendary-reveal.mp3** - Legendary card reveals
  - Duration: ~1-2 seconds
  - Format: MP3, 128-256kbps
  - Type: Grand fanfare or epic reveal sound
  - Used in: Legendary rarity reveals

### Marketplace Sounds
- **auction-bid.mp3** - Bid placed confirmation
  - Duration: ~0.5-1 second
  - Format: MP3, 128-256kbps
  - Type: Cash register or bid confirmation
  - Used in: Market browser, auction bidding

### Crafting Sounds
- **craft-success.mp3** - Successful crafting
  - Duration: ~1-2 seconds
  - Format: MP3, 128-256kbps
  - Type: Success chime or magical success
  - Used in: Crafting workbench success

- **craft-fail.mp3** - Failed crafting attempt
  - Duration: ~0.5-1 second
  - Format: MP3, 128-256kbps
  - Type: Error buzz or fail sound
  - Used in: Crafting workbench failure

### Trading Sounds
- **trade-complete.mp3** - Trade completed successfully
  - Duration: ~1-2 seconds
  - Format: MP3, 128-256kbps
  - Type: Success fanfare or completion sound
  - Used in: Trade negotiation completion

## Sound Sources (Free/Royalty-Free)

You can find suitable sounds from:
- [Freesound.org](https://freesound.org/)
- [Zapsplat.com](https://www.zapsplat.com/)
- [Mixkit.co](https://mixkit.co/free-sound-effects/)
- [Pixabay](https://pixabay.com/sound-effects/)

Search terms:
- "card flip", "whoosh", "magic reveal", "fanfare", "ding", "shimmer"

## Implementation Notes

The pack opening service (`src/lib/pack-opening-service.ts`) automatically handles missing files:
- If a sound file is missing, it logs a warning to console
- The animation continues without audio
- No user-facing errors are shown
- This allows development/testing without sound assets

## Adding Sound Files

1. Download or create your sound files
2. Convert to MP3 format (128-256kbps recommended)
3. Rename to match the exact filenames above
4. Place in this directory
5. Clear browser cache and reload to test

## Sound Service Features

The sound system (`src/lib/sound-service.ts`) provides:

- **Volume Controls**: Master, SFX, and Music volume sliders (0-100%)
- **Individual Muting**: Toggle specific sounds on/off
- **Settings Persistence**: Saves preferences to localStorage
- **Graceful Degradation**: Missing files don't break functionality
- **Preloading**: All sounds preloaded for instant playback
- **Preview Mode**: Test sounds in settings UI

## Usage in Components

```typescript
import { getSoundService } from "~/lib/sound-service";

const soundService = getSoundService();

// Play a sound
soundService.play("card-flip");

// Play rarity-specific reveal
soundService.playRarityReveal("LEGENDARY");

// Adjust volume
soundService.setMasterVolume(0.8);
soundService.setSfxVolume(0.7);

// Mute/unmute
soundService.toggleSoundMute("card-hover");

// Enable/disable all sounds
soundService.setEnabled(false);
```

## Settings UI

Access sound settings through the Settings component:
- Location: `src/components/settings/SoundSettings.tsx`
- Features: Volume sliders, sound previews, reset to defaults
- Persistence: Auto-saves to localStorage

## Current Status

🔴 No sound files present - system running in silent mode (graceful fallback)

Add MP3 files to `/public/sounds/cards/` to enable audio.
