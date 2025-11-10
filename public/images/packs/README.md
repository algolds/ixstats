# Pack Artwork for IxCards

This directory contains pack artwork images for the IxCards trading card system.

## Required Image Files (Optional)

The pack system gracefully handles missing images - packs will show text-based fallback designs with gradient backgrounds.

### Pack Type Images
- **starter-pack.png** - Starter Pack (100 IxC)
  - Dimensions: 512x768px (2:3 aspect ratio)
  - Format: PNG with transparency
  - Style: Basic/bronze theme

- **booster-pack.png** - Booster Pack (250 IxC)
  - Dimensions: 512x768px (2:3 aspect ratio)
  - Format: PNG with transparency
  - Style: Standard/silver theme

- **premium-pack.png** - Premium Pack (500 IxC)
  - Dimensions: 512x768px (2:3 aspect ratio)
  - Format: PNG with transparency
  - Style: Premium/gold theme

### Optional Pack Types (Future)
- **elite-pack.png** - Elite Pack
- **legendary-pack.png** - Legendary Pack
- **seasonal-pack.png** - Seasonal/Event Packs

## Design Guidelines

### Visual Style
- Match IxStats glass physics aesthetic
- Use gradients and glowing effects
- Include holographic/metallic finishes
- Clear visual hierarchy (starter → premium)

### Color Schemes
- **Starter**: Bronze/brown tones (#CD7F32)
- **Booster**: Silver/gray tones (#C0C0C0)
- **Premium**: Gold/yellow tones (#FFD700)

### Technical Specs
- Resolution: 512x768px minimum (1024x1536px for retina)
- Format: PNG with transparency
- File size: <500KB per image
- Color depth: 24-bit RGB + alpha channel

## Fallback Behavior

When images are missing, the pack opening system shows:
- Pack type name in large text
- Gradient background (matches pack tier)
- Glass effect styling
- Card count and price information
- "Tap to Open" instruction

## Image Sources

You can create pack artwork using:
- **Photoshop/GIMP**: Manual design
- **Canva**: Template-based design
- **Midjourney/DALL-E**: AI-generated artwork
- **Blender**: 3D rendered packs

## Implementation Notes

The pack opening components automatically detect missing images:
- `PackPurchaseModal.tsx` shows fallback gradient
- `Stage1_PackReveal.tsx` displays text-based pack
- No errors shown to users
- Console warnings for developers

## Adding Pack Images

1. Create or download pack artwork
2. Resize to 512x768px (or 1024x1536px for retina)
3. Save as PNG with transparency
4. Rename to match exact filenames above
5. Place in this directory
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

🔴 No pack images present - system using text-based fallback designs
