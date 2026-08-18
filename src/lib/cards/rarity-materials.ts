/**
 * Rarity Material Physics Engine (Apple Design / Facet Materials)
 *
 * Defines distinctive physical material identities, surface shaders,
 * dynamic caustic glares, tier-specific borders, and particle systems
 * for all 8 card rarity tiers.
 */

export type MaterialFinishType =
  | "AUTO"
  | "MATTE_PAPER"
  | "GLOSS_POLYMER"
  | "PRISMATIC_FOIL"
  | "CRACKED_ICE"
  | "COSMIC_STARDUST"
  | "GILDED_GOLD"
  | "ASTRAL_VOID"
  | "SOLAR_CROWN";

export interface RarityMaterialConfig {
  rarity: string;
  name: string;
  materialName: string;
  description: string;
  defaultFinish: MaterialFinishType;

  // Visual appearance
  baseGradient: string;
  surfaceTexture: string;
  specularColor: string;
  glareIntensity: number; // 0 - 1

  // Borders & Frames
  borderStyle: string;
  borderColor: string;
  borderGlow: string;
  cornerTreatment:
    "none" | "chamfer" | "engraved_bracket" | "laser_emitter" | "filigree" | "celestial_rune";

  // Emblem / Sigil treatment
  emblemTreatment:
    | "matte"
    | "gloss"
    | "prismatic_chrome"
    | "cyan_crystal"
    | "amethyst_glow"
    | "gilded_gold"
    | "astral_hologram"
    | "solar_incandescent";
  emblemFilter: string;

  // Particle & Lighting FX
  particles: {
    enabled: boolean;
    count: number;
    colors: string[];
    type: "sparkle" | "stars" | "embers" | "solar_motes";
    speed: number;
  };
  causticWaves: boolean;
  lightRays: boolean;
  chromaticAberration: boolean;
}

export const RARITY_MATERIALS: Record<string, RarityMaterialConfig> = {
  COMMON: {
    rarity: "COMMON",
    name: "Common",
    materialName: "Matte Archival Cardstock",
    description: "Pressed tactile linen paper with fine graphite bevels and diffuse matte finish.",
    defaultFinish: "MATTE_PAPER",
    baseGradient: "from-stone-900 via-zinc-900 to-neutral-950",
    surfaceTexture:
      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 80%)",
    specularColor: "rgba(255, 255, 255, 0.08)",
    glareIntensity: 0.15,
    borderStyle: "border border-white/10",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderGlow: "shadow-none",
    cornerTreatment: "none",
    emblemTreatment: "matte",
    emblemFilter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
    particles: {
      enabled: false,
      count: 0,
      colors: [],
      type: "sparkle",
      speed: 1,
    },
    causticWaves: false,
    lightRays: false,
    chromaticAberration: false,
  },

  UNCOMMON: {
    rarity: "UNCOMMON",
    name: "Uncommon",
    materialName: "Emerald Gloss Polymer",
    description: "Polished polymer resin with directional emerald specular sheen.",
    defaultFinish: "GLOSS_POLYMER",
    baseGradient: "from-emerald-950/80 via-slate-950 to-teal-950/80",
    surfaceTexture: "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, transparent 60%)",
    specularColor: "rgba(16, 185, 129, 0.35)",
    glareIntensity: 0.35,
    borderStyle: "border border-emerald-500/40",
    borderColor: "rgba(16, 185, 129, 0.5)",
    borderGlow: "shadow-[0_0_15px_rgba(16,185,129,0.2)]",
    cornerTreatment: "chamfer",
    emblemTreatment: "gloss",
    emblemFilter:
      "drop-shadow(0 0 8px rgba(16,185,129,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
    particles: {
      enabled: false,
      count: 0,
      colors: ["#10b981", "#34d399"],
      type: "sparkle",
      speed: 1,
    },
    causticWaves: false,
    lightRays: false,
    chromaticAberration: false,
  },

  RARE: {
    rarity: "RARE",
    name: "Rare",
    materialName: "Cobalt Prismatic Foil",
    description: "Micro-etched holographic foil with multi-angle rainbow dispersion lines.",
    defaultFinish: "PRISMATIC_FOIL",
    baseGradient: "from-blue-950 via-indigo-950 to-slate-950",
    surfaceTexture:
      "linear-gradient(45deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.2) 50%, rgba(147,51,234,0.15) 100%)",
    specularColor: "rgba(96, 165, 250, 0.5)",
    glareIntensity: 0.55,
    borderStyle: "border-2 border-blue-500/60",
    borderColor: "rgba(59, 130, 246, 0.7)",
    borderGlow: "shadow-[0_0_20px_rgba(59,130,246,0.35)]",
    cornerTreatment: "engraved_bracket",
    emblemTreatment: "prismatic_chrome",
    emblemFilter:
      "drop-shadow(0 0 10px rgba(59,130,246,0.7)) drop-shadow(0 4px 8px rgba(0,0,0,0.9))",
    particles: {
      enabled: true,
      count: 8,
      colors: ["#60a5fa", "#818cf8", "#c084fc"],
      type: "sparkle",
      speed: 1.2,
    },
    causticWaves: true,
    lightRays: false,
    chromaticAberration: false,
  },

  ULTRA_RARE: {
    rarity: "ULTRA_RARE",
    name: "Ultra Rare",
    materialName: "Cyan Liquid Crystal Glass",
    description: "Optical refractive glass slab with cyan laser emitters and spectral caustics.",
    defaultFinish: "CRACKED_ICE",
    baseGradient: "from-cyan-950 via-slate-950 to-blue-950",
    surfaceTexture: "radial-gradient(ellipse at 30% 20%, rgba(6,182,212,0.25) 0%, transparent 60%)",
    specularColor: "rgba(34, 211, 238, 0.65)",
    glareIntensity: 0.7,
    borderStyle: "border-2 border-cyan-400/70 ring-1 ring-cyan-400/30",
    borderColor: "rgba(34, 211, 238, 0.85)",
    borderGlow: "shadow-[0_0_25px_rgba(6,182,212,0.45),inset_0_0_10px_rgba(6,182,212,0.2)]",
    cornerTreatment: "laser_emitter",
    emblemTreatment: "cyan_crystal",
    emblemFilter:
      "drop-shadow(0 0 12px rgba(6,182,212,0.9)) drop-shadow(0 0 20px rgba(59,130,246,0.5))",
    particles: {
      enabled: true,
      count: 14,
      colors: ["#22d3ee", "#38bdf8", "#818cf8"],
      type: "sparkle",
      speed: 1.5,
    },
    causticWaves: true,
    lightRays: true,
    chromaticAberration: true,
  },

  EPIC: {
    rarity: "EPIC",
    name: "Epic",
    materialName: "Amethyst Starry Lattice",
    description:
      "Deep cosmic amethyst crystalline matrix with floating stardust and starry twinkle grid.",
    defaultFinish: "COSMIC_STARDUST",
    baseGradient: "from-purple-950 via-indigo-950 to-pink-950",
    surfaceTexture: "radial-gradient(circle at 70% 30%, rgba(168,85,247,0.3) 0%, transparent 60%)",
    specularColor: "rgba(192, 132, 252, 0.75)",
    glareIntensity: 0.8,
    borderStyle: "border-2 border-purple-400/80 ring-2 ring-pink-500/30",
    borderColor: "rgba(192, 132, 252, 0.9)",
    borderGlow: "shadow-[0_0_30px_rgba(168,85,247,0.5),inset_0_0_15px_rgba(236,72,153,0.3)]",
    cornerTreatment: "engraved_bracket",
    emblemTreatment: "amethyst_glow",
    emblemFilter:
      "drop-shadow(0 0 14px rgba(168,85,247,0.9)) drop-shadow(0 0 25px rgba(236,72,153,0.6))",
    particles: {
      enabled: true,
      count: 20,
      colors: ["#c084fc", "#f472b6", "#e879f9", "#ffffff"],
      type: "stars",
      speed: 1.8,
    },
    causticWaves: true,
    lightRays: true,
    chromaticAberration: true,
  },

  LEGENDARY: {
    rarity: "LEGENDARY",
    name: "Legendary",
    materialName: "24K Stamped Gilded Relic",
    description:
      "Heavy 24K gold foil embossed over obsidian slate with molten radial rays and ornate filigree.",
    defaultFinish: "GILDED_GOLD",
    baseGradient: "from-amber-950/90 via-slate-950 to-yellow-950/90",
    surfaceTexture: "radial-gradient(circle at 50% 40%, rgba(234,179,8,0.35) 0%, transparent 70%)",
    specularColor: "rgba(250, 204, 21, 0.9)",
    glareIntensity: 0.9,
    borderStyle: "border-[2.5px] border-amber-400 ring-2 ring-yellow-500/40",
    borderColor: "rgba(250, 204, 21, 1)",
    borderGlow: "shadow-[0_0_35px_rgba(234,179,8,0.6),inset_0_0_20px_rgba(245,158,11,0.4)]",
    cornerTreatment: "filigree",
    emblemTreatment: "gilded_gold",
    emblemFilter:
      "drop-shadow(0 0 16px rgba(234,179,8,1)) drop-shadow(0 0 30px rgba(245,158,11,0.7))",
    particles: {
      enabled: true,
      count: 26,
      colors: ["#fde047", "#facc15", "#f59e0b", "#ffffff"],
      type: "embers",
      speed: 2.0,
    },
    causticWaves: true,
    lightRays: true,
    chromaticAberration: false,
  },

  MYTHIC: {
    rarity: "MYTHIC",
    name: "Mythic",
    materialName: "Astral Void Glass",
    description:
      "Deep black cosmic void with swirling nebula core and prismatic chromatic aberration.",
    defaultFinish: "ASTRAL_VOID",
    baseGradient: "from-rose-950 via-slate-950 to-purple-950",
    surfaceTexture:
      "radial-gradient(circle at 40% 60%, rgba(244,63,94,0.3) 0%, rgba(139,92,246,0.3) 50%, transparent 80%)",
    specularColor: "rgba(251, 113, 133, 0.9)",
    glareIntensity: 0.95,
    borderStyle: "border-[2.5px] border-rose-500/90 ring-2 ring-purple-500/50",
    borderColor: "rgba(244, 63, 94, 1)",
    borderGlow: "shadow-[0_0_40px_rgba(244,63,94,0.6),inset_0_0_25px_rgba(139,92,246,0.5)]",
    cornerTreatment: "engraved_bracket",
    emblemTreatment: "astral_hologram",
    emblemFilter:
      "drop-shadow(0 0 18px rgba(244,63,94,1)) drop-shadow(0 0 35px rgba(139,92,246,0.8))",
    particles: {
      enabled: true,
      count: 32,
      colors: ["#fb7185", "#c084fc", "#38bdf8", "#ffffff"],
      type: "stars",
      speed: 2.2,
    },
    causticWaves: true,
    lightRays: true,
    chromaticAberration: true,
  },

  DIVINE: {
    rarity: "DIVINE",
    name: "Divine",
    materialName: "Solar Celestial Crown",
    description:
      "Blinding celestial solar pearl with sacred runes, corona flares, and radiant aura.",
    defaultFinish: "SOLAR_CROWN",
    baseGradient: "from-amber-950 via-yellow-950 to-slate-950",
    surfaceTexture:
      "radial-gradient(circle at 50% 50%, rgba(253,224,71,0.45) 0%, rgba(245,158,11,0.2) 60%, transparent 90%)",
    specularColor: "rgba(255, 255, 255, 1)",
    glareIntensity: 1.0,
    borderStyle: "border-[3px] border-yellow-200 ring-4 ring-amber-400/50",
    borderColor: "rgba(254, 240, 138, 1)",
    borderGlow: "shadow-[0_0_50px_rgba(250,204,21,0.8),inset_0_0_30px_rgba(253,224,71,0.6)]",
    cornerTreatment: "celestial_rune",
    emblemTreatment: "solar_incandescent",
    emblemFilter:
      "drop-shadow(0 0 22px rgba(255,255,255,1)) drop-shadow(0 0 45px rgba(250,204,21,0.9))",
    particles: {
      enabled: true,
      count: 40,
      colors: ["#ffffff", "#fef08a", "#fde047", "#f59e0b"],
      type: "solar_motes",
      speed: 2.5,
    },
    causticWaves: true,
    lightRays: true,
    chromaticAberration: true,
  },
};

import { getCategoryTheme } from "./category-theme";
import type { LoreCategory } from "./category-enums";

export function getRarityMaterial(rarity?: string | null): RarityMaterialConfig {
  const safe = (rarity ?? "COMMON").toUpperCase();
  return RARITY_MATERIALS[safe] ?? RARITY_MATERIALS.COMMON!;
}

/**
 * Helper to dynamically blend Lore Category accent themes into card Rarity Material physics (Approach C Hybrid Engine)
 */
export function getHybridRarityMaterial(
  rarity?: string | null,
  category?: string | null,
  enableCategoryTint: boolean = true
): RarityMaterialConfig {
  const baseMat = getRarityMaterial(rarity);

  if (!enableCategoryTint || !category) {
    return baseMat;
  }

  const catTheme = getCategoryTheme(category as LoreCategory);
  if (!catTheme) return baseMat;

  return {
    ...baseMat,
    borderGlow: `${baseMat.borderGlow} drop-shadow(0 0 10px ${catTheme.accentColor})`,
    particles: {
      ...baseMat.particles,
      colors: baseMat.particles.enabled
        ? [catTheme.accentColor, ...baseMat.particles.colors.slice(0, 3)]
        : baseMat.particles.colors,
    },
  };
}
