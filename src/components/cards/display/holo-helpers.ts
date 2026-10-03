import { useEffect, useRef, useState } from "react";
import type { CardRarity } from "@prisma/client";
import {
  getRainbowHolographicGradient,
  getSparkleGridGradient,
  getPrismaticWaveGradient,
  getHolofoilTextureGradient,
} from "~/lib/themes";

const VALID_RARITIES = new Set(["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"]);

export function getEffectiveRarity(rarity?: string | null): CardRarity {
  if (rarity && VALID_RARITIES.has(rarity)) return rarity as CardRarity;
  return "COMMON";
}

export function getHoloGradient(rarity: CardRarity): string {
  switch (rarity) {
    case "LEGENDARY":
      return `${getSparkleGridGradient()}, ${getPrismaticWaveGradient()}`;
    case "EPIC":
      return getSparkleGridGradient();
    case "ULTRA_RARE":
      return getPrismaticWaveGradient();
    case "RARE":
      return getRainbowHolographicGradient(135);
    default:
      return getHolofoilTextureGradient();
  }
}

const COVER_HOLO_OPACITY: Record<CardRarity, number> = {
  COMMON: 0.12,
  UNCOMMON: 0.2,
  RARE: 0.3,
  ULTRA_RARE: 0.4,
  EPIC: 0.5,
  LEGENDARY: 0.65,
};

/** Foil intensity for the card-face covers (card and lore); dimmed unless hovered. */
export function getCoverHoloOpacity(rarity: CardRarity, isHovered: boolean): number {
  const opacity = COVER_HOLO_OPACITY[rarity] ?? 0.12;
  return isHovered ? opacity : opacity * 0.4;
}

/** Cursor position relative to the returned container while `isHovered`. */
export function useHoverMousePos(isHovered: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isHovered) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isHovered]);

  return { containerRef, mousePos };
}
