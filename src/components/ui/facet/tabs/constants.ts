/**
 * FacetTabs metrics (Facet 3): a `fill-3` track with a raised `control-thumb` indicator, the
 * control radius tokens, footnote/subhead labels. `padding` (px) must match the track's padding
 * class — the indicator physics offsets by it.
 */
export const sizeClasses = {
  sm: {
    container: "p-0.5 rounded-control gap-0.5",
    item: "px-3 py-1 text-footnote gap-1 rounded-control-sm font-medium active:scale-[0.97] transition-transform",
    icon: "size-3",
    indicator: "rounded-control-sm",
    indicatorInset: "inset-y-0.5",
    padding: 2,
  },
  md: {
    container: "p-1 rounded-control-lg gap-1",
    item: "px-3 py-2 text-footnote gap-2 rounded-control-sm font-medium active:scale-[0.97] transition-transform",
    icon: "size-3.5",
    indicator: "rounded-control-sm",
    indicatorInset: "inset-y-1",
    padding: 4,
  },
  lg: {
    container: "p-2 rounded-card gap-2",
    item: "px-5 py-2 text-subhead gap-2 rounded-control font-semibold active:scale-[0.98] transition-transform",
    icon: "size-4",
    indicator: "rounded-control",
    indicatorInset: "inset-y-2",
    padding: 8,
  },
} as const;

export type FacetTabsTone = "neutral" | "accent" | "mycountry" | "forum" | "sdi";

/**
 * The colour each tone gives the active tab's icon (and a `themeColor`-less indicator's edge):
 * roles and system colours, so it follows the theme and Increase Contrast. `accent` is the app
 * tint.
 */
export const TONE_COLOR: Record<FacetTabsTone, string> = {
  neutral: "var(--color-label)",
  accent: "var(--color-tint)",
  mycountry: "var(--color-yellow)",
  forum: "var(--color-orange)",
  sdi: "var(--color-red)",
};

/** Active-icon classes per tone (written out so Tailwind sees them). */
export const toneIconClasses: Record<FacetTabsTone, string> = {
  neutral: "text-label",
  accent: "text-tint",
  mycountry: "text-yellow",
  forum: "text-orange",
  sdi: "text-red",
};

/** The sliding indicator: the same raised thumb as `SegmentedControl` for every tone. */
export const toneIndicatorStyles: Record<FacetTabsTone, string> = {
  neutral: "bg-control-thumb border-transparent shadow-card",
  accent: "bg-control-thumb border-transparent shadow-card",
  mycountry: "bg-control-thumb border-transparent shadow-card",
  forum: "bg-control-thumb border-transparent shadow-card",
  sdi: "bg-control-thumb border-transparent shadow-card",
};

/** @deprecated FacetTabs has no glow layer in Facet 3; kept for imports. */
export const toneGlowClasses: Record<FacetTabsTone, string> = {
  neutral: "",
  accent: "",
  mycountry: "",
  forum: "",
  sdi: "",
};

import {
  DRAG_ELASTICITY as SHARED_DRAG_ELASTICITY,
  DRAG_DEAD_ZONE as SHARED_DRAG_DEAD_ZONE,
} from "../shared/constants";

export const grabSpringConfig = {
  stiffness: 400,
  damping: 22,
};

export const DRAG_ELASTICITY = SHARED_DRAG_ELASTICITY;
export const DRAG_DEAD_ZONE = SHARED_DRAG_DEAD_ZONE;
