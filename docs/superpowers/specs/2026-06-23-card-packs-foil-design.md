# Interactive Card Packs Foil Spec

This document details the visual shaders, 3D tilt mechanics, and layer composition for the upgraded Card Pack wrapper component (`PackHolographicCover`).

## 1. Interaction Model (3D Tilt & Specular Highlights)

To ensure a highly responsive, GPU-accelerated feel:
1. **Pointer Tracking**: Native React pointer event handlers (`onPointerMove`, `onPointerLeave`) capture cursor position relative to the container bounding box.
2. **CSS Custom Variables**: The mouse coordinates are mapped to percentage values and stored directly in CSS variables on the container element:
   - `--r-x`: Tilt angle on the Y-axis (driven by horizontal offset).
   - `--r-y`: Tilt angle on the X-axis (driven by vertical offset).
   - `--m-x` / `--m-y`: Specular highlight center coordinates.
   - `--bg-x` / `--bg-y`: Holographic film sweep offsets.
   - `--opacity`: Glow opacity (toggled from `0` to `0.65` on hover).
3. **GPU Composition**: 3D rotation uses `transform: rotateY(var(--r-x)) rotateX(var(--r-y))` inside a perspective-projected container. Glare moves with `--m-x` and `--m-y`.

---

## 2. Layer Composition Stack

The pack wrapper renders five layers stacked from bottom to top:

### Layer 1: Base (Pack Artwork or Theme Background)
- Renders the custom pack artwork image (`packArtwork`) if available.
- Falls back to the standard CSS theme gradients defined in `PACK_THEMES` if no custom artwork is supplied.

### Layer 2: Holographic Film Sweep
- Blends a rainbow gradient refraction sweep on top of the base layer.
- **Refraction Angle**: Refraction angles and patterns scale up by rarity (Common = simple sweep, Legendary = sparkle grid + prismatic wave).
- **Blending**: Set to `mix-blend-mode: color-dodge` for a high-intensity, metallic foil reflection.

### Layer 3: Embossed Geometry & Stamp Accents
- Renders the card pack name, geometric vectors, and rarity stamps.
- Applies an embossed text shadow to the text overlays for an engraved, premium look.

### Layer 4: Foil Noise Overlay
- An inline SVG fractal noise texture is encoded as a data URI and layered above the artwork:
  ```css
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")
  ```
- **Blending**: `mix-blend-mode: overlay` (or soft-light) to mimic micro-scratches and metallic grain imperfections.

### Layer 5: Specular Glare (Apple-Style Highlight)
- A radial gradient centered at `var(--m-x) var(--m-y)` that lights up under the cursor.
- **Blending**: `mix-blend-mode: overlay` (or soft-light) with variable opacity (`var(--opacity)`), transitioning smoothly on cursor hover.

---

## 3. Component & Page Integration

1. **`PackHolographicCover.tsx` Upgrades:**
   - Integrate pointer tracking state and CSS variables.
   - Always run the overlay shaders (Layer 2, 4, 5) even when `packArtwork` is present.
   - Add size conditional rendering: only apply 3D tilt and mouse-highlights when size is `md` or `lg` (skipping `sm` thumbs).
2. **`Stage1_PackReveal.tsx` Wiring:**
   - Always render `PackHolographicCover` passing both `packType` and `packArtwork`.
