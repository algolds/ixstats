# Technical Design Spec: Unified Rarity Color & Material Engine

**Date**: 2026-08-17  
**Status**: Approved  
**Scope**: Unified 8-Tier Rarity System (`COMMON` → `DIVINE`), Hybrid Category Accent Tinting, Apple Glassmorphic & TCG Material Refraction, Card Designer & Display Components.

---

## 1. Executive Summary

This design establishes a unified, Apple-grade color and material hierarchy for all 8 card rarity tiers in IxStats, fusing **Apple Design Foundations** (translucent materials, physical light refraction, context-aware vibrancy) with **Yu-Gi-Oh / TCG Rarity Traditions** (Normal, Super Rare, Ultra Rare, Secret Rare, Ultimate/Gold, Starlight/Ghost, Pharaoh/Collector).

Additionally, it introduces a **Dynamic Category Accent Hybrid Engine** that blends a card's domain category accent (e.g. Military Crimson, Science Cyan, Economy Gold) into the rarity material's specular highlights, border glows, and particle effects.

---

## 2. 8-Tier Rarity Color Matrix & TCG Material Identities

Each tier establishes a distinct physical material identity, border style, specular highlight, and particle effect:

| Tier | Rarity | TCG Inspiration | Primary Color / Token | Surface Material & Finish | Border & Glow Treatment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T1** | `COMMON` | Normal Card | **Slate / Graphite** (`#94a3b8`) | Matte Archival Paper | Slate 1px border, diffuse matte finish |
| **T2** | `UNCOMMON` | Super Rare | **Emerald / Teal** (`#10b981`) | Gloss Polymer Resin | Emerald 1px border + directional green specular sheen |
| **T3** | `RARE` | Ultra Rare | **Cobalt Sapphire** (`#3b82f6`) | Micro-Etched Prismatic Foil | Blue 2px border + engraved corner brackets |
| **T4** | `ULTRA_RARE` | Secret Rare | **Electric Cyan** (`#06b6d4`) | Liquid Crystal Glass | Cyan 2px border + parallel laser lines & spectral caustics |
| **T5** | `EPIC` | Ultimate / Cosmic | **Amethyst Violet** (`#a855f7`) | Starry Cosmic Lattice | Purple 2px ring border + floating stardust particles |
| **T6** | `LEGENDARY` | Gold / Gilded | **24K Imperial Gold** (`#eab308`) | Stamped Gold Relic | Gold 2.5px ring border + ornate filigree corners & molten rays |
| **T7** | `MYTHIC` | Starlight / Ghost | **Crimson Astral Void** (`#f43f5e`) | Astral Void Glass | Rose-Purple 2.5px ring border + nebula core & chromatic aberration |
| **T8** | `DIVINE` | Pharaoh / God Tier | **Solar Celestial** (`#fef08a`) | Solar Corona Crown | Celestial White 3px ring border + radiant aura & golden runes |

---

## 3. Dynamic Category Tinting (Approach C Hybrid Engine)

To give every card a unique personal identity while preserving instant tier recognition:

1. **Base Color (Rarity Tier)**: Governs 80% of the material weight (foil sheen, border structure, card back trim, particle types).
2. **Category Accent Overlay (15–20% HSL Tint)**:
   - **`MILITARY`**: Crimson / Ruby Tint (`#ef4444`)
   - **`DIPLOMACY`**: Amber / Bronze Tint (`#f59e0b`)
   - **`GEOGRAPHY`**: Deep Teal / Forest Tint (`#0d9488`)
   - **`PEOPLE`**: Royal Purple Tint (`#8b5cf6`)
   - **`SCIENCE`**: Electric Cyan / Plasma Tint (`#06b6d4`)
   - **`ECONOMY`**: Gold / Currency Tint (`#eab308`)
   - **`GOVERNMENT`**: Steel Blue Tint (`#3b82f6`)
   - **`RELIGION`**: Deep Indigo / Mystic Tint (`#6366f1`)
   - **`CULTURE`**: Warm Rose Tint (`#f43f5e`)
   - **`HISTORY`**: Sepia Obsidian Tint (`#d97706`)
   - **`NATION`**: Sovereign Gold Tint (`#eab308`)
   - **`SPECIAL`**: Emerald Plasma Tint (`#10b981`)
3. **Blend Mechanics**:
   - The category accent color subtlely infuses into the specular glare, border glow shadow (`shadow-[0_0_25px_var(--category-accent)]`), and particle highlight colors.
   - For example, a **`LEGENDARY` (`24K Gold`) `MILITARY`** card retains its gold gilded foil and filigree corners, but carries a dramatic ruby-gold molten glow and crimson particle motes.

---

## 4. Card Designer UI Controls & 3D Stage Realtime Updates

In [`DesignerControlRack.tsx`](file:///home/jxsig/projects/ixstats/src/components/cards/designer/DesignerControlRack.tsx):

1. **Rarity Selector**: Expand from 6 to all 8 tiers (`COMMON` → `DIVINE`).
2. **Category Tint Mode Toggle**:
   - **Auto Category-Tinted** (Recommended default — dynamically blends Category theme into Rarity materials).
   - **Pure Rarity Spectrum** (Classic un-tinted TCG material appearance).
3. **Real-time Dual-Side Updating**:
   - Updates [`rarity-materials.ts`](file:///home/jxsig/projects/ixstats/src/lib/cards/rarity-materials.ts) config on [`DesignerStage3D.tsx`](file:///home/jxsig/projects/ixstats/src/components/cards/designer/DesignerStage3D.tsx) in real time.
   - Updates [`CardBack.tsx`](file:///home/jxsig/projects/ixstats/src/components/cards/display/CardBack.tsx) emblem rings, border glow, and metallic foil finishes on flip simultaneously.

---

## 5. Codebase & Architecture Changes

1. **[`src/lib/card-display-utils.ts`](file:///home/jxsig/projects/ixstats/src/lib/card-display-utils.ts)**:
   - Add `MYTHIC` and `DIVINE` to `CARD_RARITIES` and `RARITY_COLORS`.
2. **[`src/lib/cards/rarity-materials.ts`](file:///home/jxsig/projects/ixstats/src/lib/cards/rarity-materials.ts)**:
   - Export helper `getHybridRarityMaterial(rarity, category, enableCategoryTint)` that merges rarity materials with category accent hues.
3. **[`src/components/cards/display/RarityBadge.tsx`](file:///home/jxsig/projects/ixstats/src/components/cards/display/RarityBadge.tsx)**:
   - Support all 8 tiers natively with Apple-grade glassmorphism, HSL borders, and shimmer effects.
4. **[`src/components/cards/designer/types.ts`](file:///home/jxsig/projects/ixstats/src/components/cards/designer/types.ts)** & **[`DesignerControlRack.tsx`](file:///home/jxsig/projects/ixstats/src/components/cards/designer/DesignerControlRack.tsx)**:
   - Wire category tinting mode state and controls into the card designer.
