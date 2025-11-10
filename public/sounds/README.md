# Sound Assets for IxCards Pack Opening

This directory contains sound effects for the IxCards pack opening experience.

## Required Sound Files (Optional)

The pack opening system gracefully handles missing sound files - the animations will work silently without them.

### Pack Opening Sounds
- **pack-open.mp3** - Explosion sound when pack bursts open
  - Duration: ~1-2 seconds
  - Format: MP3, 128-256kbps
  - Type: Whoosh/explosion effect

### Card Reveal Sounds (Rarity-based)
- **common-reveal.mp3** - Common/Uncommon card reveals
  - Duration: ~0.5-1 second
  - Format: MP3, 128-256kbps
  - Type: Soft "ding" or card flip sound

- **rare-reveal.mp3** - Rare/Ultra Rare card reveals
  - Duration: ~0.5-1 second
  - Format: MP3, 128-256kbps
  - Type: Brighter "ding" with shimmer

- **legendary-reveal.mp3** - Epic/Legendary card reveals
  - Duration: ~1-2 seconds
  - Format: MP3, 128-256kbps
  - Type: Grand fanfare or epic reveal sound

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

## Current Status

🔴 No sound files present - system running in silent mode (graceful fallback)
