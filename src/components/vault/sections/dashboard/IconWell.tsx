import type { ComponentProps } from "react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils/cn";

const SIZES = {
  sm: "size-6 [&_svg]:size-3.5",
  // Direct-child selector: the Vault mark nests an inner svg for its cut-out that must keep its own size.
  lg: "size-12 [&>span>svg]:size-7",
} as const;

interface IconWellProps extends ComponentProps<"span"> {
  size?: keyof typeof SIZES;
}

/**
 * A tinted decorative icon tile: the mark on a statement row, a Your Vault row or a Showcase tile. The icon sits on
 * the tint fill under a sanctioned dots texture drawn in the tint (the neutral ink all but vanishes at the cap).
 */
export function IconWell({ className, children, size = "sm", ...props }: IconWellProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-tint-fill text-tint rounded-row relative flex shrink-0 items-center justify-center overflow-hidden",
        SIZES[size],
        className
      )}
      {...props}
    >
      <TextureOverlay texture="dots" className="[--facet-texture-color:var(--tint)]" />
      <span className="relative flex">{children}</span>
    </span>
  );
}
