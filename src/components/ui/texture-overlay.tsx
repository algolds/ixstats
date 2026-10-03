import { cn } from "~/lib/utils/cn";

export type TextureType =
  | "dots"
  | "grid"
  | "crosshatch"
  | "triangular"
  | "chevron"
  | "paperGrain"
  | "waves"
  | "shimmer"
  | "diamonds"
  | "none";

/**
 * The sanctioned textures: decorative only (empty states, heroes, wiki reading surface, Builder
 * panels), opacity at most `TEXTURE_MAX_OPACITY`, never on data. The other `TextureType` values
 * are card art (Vault) or pending removal.
 */
export const SANCTIONED_TEXTURES = [
  "dots",
  "grid",
  "paperGrain",
  "chevron",
] as const satisfies readonly TextureType[];
export type SanctionedTexture = (typeof SANCTIONED_TEXTURES)[number];

/** The cap for a sanctioned texture; `TextureOverlay` clamps sanctioned textures to it. */
export const TEXTURE_MAX_OPACITY = 0.05;

export function isSanctionedTexture(texture: TextureType): texture is SanctionedTexture {
  return (SANCTIONED_TEXTURES as readonly TextureType[]).includes(texture);
}

interface TextureOverlayProps {
  texture: TextureType;
  opacity?: number;
  className?: string;
}

const texturePatterns: Record<TextureType, string> = {
  dots: "facet-texture-dots",
  grid: "facet-texture-grid",
  crosshatch: "facet-texture-crosshatch",
  triangular: "facet-texture-triangular",
  chevron: "facet-texture-chevron",
  paperGrain: "facet-texture-paper-grain",
  waves: "facet-texture-waves",
  shimmer: "facet-texture-shimmer",
  diamonds: "facet-texture-diamonds",
  none: "",
};

const defaultOpacities: Record<TextureType, number> = {
  dots: 1,
  grid: 1,
  crosshatch: 1,
  triangular: 1,
  chevron: 1,
  paperGrain: 1,
  waves: 1,
  shimmer: 0.6,
  diamonds: 1,
  none: 0,
};

export function TextureOverlay({ texture, opacity, className }: TextureOverlayProps) {
  if (texture === "none") return null;

  const requested = opacity ?? defaultOpacities[texture];
  // Sanctioned textures are decoration under content: never above the cap.
  const finalOpacity = isSanctionedTexture(texture)
    ? Math.min(requested, TEXTURE_MAX_OPACITY)
    : requested;
  const pattern = texturePatterns[texture];

  return (
    <div
      aria-hidden
      className={cn("texture-overlay pointer-events-none absolute inset-0", pattern, className)}
      style={{ opacity: finalOpacity }}
    />
  );
}
