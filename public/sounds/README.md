# Sound Assets for IxCards System

This directory is reserved for optional MP3 sound effects for the IxCards experience.

> **Status (September 2026): legacy / dormant.** Platform UI audio is now **Cuelume** — 17 synthesized Web Audio cues (`press`, `release`, `toggle`, `tick`, `chime`, `whisper`, `bloom`, `droplet`, `page`, `scan`, `loading`, `ready`, `arrival`, `pulse`, `sparkle`, `success`, `error`) exposed via `soundEffects` in `src/lib/sound/cuelume.ts`, which needs no audio files. The MP3-based `SoundService` described below still exists at `src/lib/media/sound-service.ts` but has no callers, and the pack-opening sound hooks in `src/lib/cards/pack-opening-service.ts` are intentionally silenced no-ops. `/public/sounds/cards/` contains only a `.gitkeep`.

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

The pack opening service (`src/lib/cards/pack-opening-service.ts`) was designed to handle missing files as follows (its sound methods are currently silenced no-ops):
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

The legacy sound system (`src/lib/media/sound-service.ts`, currently unused) provides:

- **Volume Controls**: Master, SFX, and Music volume sliders (0-100%)
- **Individual Muting**: Toggle specific sounds on/off
- **Settings Persistence**: Saves preferences to localStorage
- **Graceful Degradation**: Missing files don't break functionality
- **Preloading**: All sounds preloaded for instant playback
- **Preview Mode**: Test sounds in settings UI

## Usage in Components

```typescript
import { getSoundService } from "~/lib/media/sound-service";

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

The legacy `SoundSettings.tsx` component no longer exists. Platform sound on/off and volume are controlled from the Halo Settings view (`src/components/halo/views/SettingsView.tsx`, via `useSoundSettings`) and persisted under `ixstates:sound-enabled` / `ixstates:sound-volume` in localStorage.

## Current Status

🔴 No sound files present, and no code path currently plays them. Adding MP3 files to `/public/sounds/cards/` will not enable audio until `SoundService` is wired back in (or the cues are ported to Cuelume).
