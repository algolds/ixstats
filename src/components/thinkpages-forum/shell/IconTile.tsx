import type { ReactNode } from "react";
import { TextureOverlay, type SANCTIONED_TEXTURES } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils/cn";

const SIZES = {
  md: "size-10 [&_svg]:size-5",
  lg: "size-12 [&_svg]:size-6",
} as const;

interface IconTileProps {
  children: ReactNode;
  size?: keyof typeof SIZES;
  texture?: (typeof SANCTIONED_TEXTURES)[number];
  className?: string;
}

/**
 * A forum entity's mark (a board, a realm): its icon on a tinted Well tile, under a sanctioned texture drawn in the
 * app tint. At the texture cap the neutral texture ink (8% white in dark) all but vanishes; the tint keeps it visible
 * while still under the cap, and the Settings textures switch still turns it off.
 */
export function IconTile({ children, size = "md", texture = "dots", className }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-tint-fill text-tint rounded-row relative flex shrink-0 items-center justify-center overflow-hidden",
        SIZES[size],
        className
      )}
    >
      <TextureOverlay texture={texture} className="[--facet-texture-color:var(--tint)]" />
      <span className="relative flex">{children}</span>
    </span>
  );
}
