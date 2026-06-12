import { cn } from "~/lib/utils";

export type TextureType =
  | "dots"
  | "grid"
  | "noise"
  | "crosshatch"
  | "diagonal"
  | "scatteredDots"
  | "halftone"
  | "triangular"
  | "chevron"
  | "paperGrain"
  | "horizontalLines"
  | "verticalLines"
  | "waves"
  | "zigzag"
  | "woven"
  | "brick"
  | "herringbone"
  | "shimmer"
  | "none";

interface TextureOverlayProps {
  texture: TextureType;
  opacity?: number;
  className?: string;
}

const texturePatterns: Record<TextureType, string> = {
  dots: "facet-texture-dots",
  grid: "facet-texture-grid",
  noise: "facet-texture-noise",
  crosshatch: "facet-texture-crosshatch",
  diagonal: "facet-texture-diagonal",
  scatteredDots: "facet-texture-scattered-dots",
  halftone: "facet-texture-halftone",
  triangular: "facet-texture-triangular",
  chevron: "facet-texture-chevron",
  paperGrain: "facet-texture-paper-grain",
  horizontalLines: "facet-texture-horizontal-lines",
  verticalLines: "facet-texture-vertical-lines",
  waves: "facet-texture-waves",
  zigzag: "facet-texture-zigzag",
  woven: "facet-texture-woven",
  brick: "facet-texture-brick",
  herringbone: "facet-texture-herringbone",
  shimmer: "facet-texture-shimmer",
  none: "",
};

const defaultOpacities: Record<TextureType, number> = {
  dots: 1,
  grid: 1,
  noise: 1,
  crosshatch: 1,
  diagonal: 1,
  scatteredDots: 1,
  halftone: 1,
  triangular: 1,
  chevron: 1,
  paperGrain: 1,
  horizontalLines: 1,
  verticalLines: 1,
  waves: 1,
  zigzag: 1,
  woven: 1,
  brick: 1,
  herringbone: 1,
  shimmer: 0.6,
  none: 0,
};

export function TextureOverlay({ texture, opacity, className }: TextureOverlayProps) {
  if (texture === "none") return null;

  const finalOpacity = opacity ?? defaultOpacities[texture];
  const pattern = texturePatterns[texture];

  return (
    <div
      className={cn("texture-overlay pointer-events-none absolute inset-0", pattern, className)}
      style={{ opacity: finalOpacity }}
    />
  );
}
