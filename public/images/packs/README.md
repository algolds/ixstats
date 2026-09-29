# Pack Artwork for IxCards

This directory contains pack artwork images for the IxCards trading card system.

## Required Image Files (Optional)

Pack artwork is data-driven: each `CardPack.artwork` holds a URL. The seed (`prisma/seeds/data/card-packs.json`) expects these SVGs here:

- Season packs: `pack_s1_recruit.svg`, `pack_s1_veteran.svg`, `pack_s1_elite.svg` … through `pack_s4_*` (12 files)
- Cross-pool packs: `pack_omni_starter.svg`, `pack_world_summit.svg`, `pack_high_roller.svg`, `pack_lore_master.svg`, `pack_champ_event.svg`, `pack_anniversary.svg`, `pack_limited_col.svg`, `pack_founder.svg`
- Optional foil overlays: `<name>_foil.svg` next to any SVG (blended by `PackHolographicCover`)

Recommended canvas: 2:3 aspect ratio (e.g. 512x768).

`public/images/*` is git-ignored (only this README is tracked), so the artwork must be deployed to the server out-of-band.

## Design Guidelines

### Visual Style
- Match IxStats glass physics aesthetic
- Use gradients and glowing effects
- Include holographic/metallic finishes
- Clear visual hierarchy (starter → premium)

### Color Schemes (suggested)
- **Recruit / BASIC**: Bronze/brown tones (#CD7F32)
- **Veteran / PREMIUM**: Silver/gray tones (#C0C0C0)
- **Commander Elite / ELITE and above**: Gold/yellow tones (#FFD700)

### Technical Specs
- Resolution: 512x768px minimum (1024x1536px for retina) if raster
- Format: SVG (matches the seeded paths); PNG works if you update `CardPack.artwork`
- File size: <500KB per image
- Color depth: 24-bit RGB + alpha channel

## Fallback Behavior

`PackHolographicCover` (`src/components/cards/pack-opening/PackHolographicCover.tsx`) renders:
- A pack-type gradient base when `CardPack.artwork` is **empty**
- The holographic foil sweep (and, above the smallest size, the pack name) on top in either case

If `artwork` is set but the file is missing, the base layer is simply blank (no error, no gradient), so either deploy the files or clear `artwork` on the pack.

## Image Sources

You can create pack artwork using:
- **Photoshop/GIMP**: Manual design
- **Canva**: Template-based design
- **Midjourney/DALL-E**: AI-generated artwork
- **Blender**: 3D rendered packs

## Implementation Notes

- `PackHolographicCover.tsx` draws the pack face for the Vault Shop (`PackHolographicCard`) and `Stage1_PackReveal.tsx`
- No errors are shown to users when images fail to load

## Adding Pack Images

1. Create or download pack artwork
2. Resize to 512x768px (or 1024x1536px for retina)
3. Save as SVG (or PNG with transparency, updating `CardPack.artwork` to match)
4. Name it to match the seeded filename (or update `CardPack.artwork` via `/admin/cards`)
5. Place in this directory on the deployed server
6. Clear browser cache and reload to test

## Examples

### Starter Pack (Bronze Theme)
```
Background: Linear gradient (#CD7F32 to #8B4513)
Text: "STARTER PACK" in bold
Glow: Subtle bronze glow
Border: Metallic bronze frame
```

### Booster Pack (Silver Theme)
```
Background: Linear gradient (#C0C0C0 to #A8A8A8)
Text: "BOOSTER PACK" in bold
Glow: Silver shimmer effect
Border: Metallic silver frame
```

### Premium Pack (Gold Theme)
```
Background: Linear gradient (#FFD700 to #FFA500)
Text: "PREMIUM PACK" in bold
Glow: Golden radiance effect
Border: Ornate gold frame with gems
```

## Current Status

🔴 No pack images in the repository (verified 2026-09-29). Seeded packs reference `pack_*.svg` files that must be supplied at deploy time; without them the pack base layer renders blank.
