export const sizeClasses = {
  sm: {
    container: "p-0.5 rounded-lg gap-0.5",
    item: "px-2.5 py-1 text-[10px] gap-1 rounded-md font-medium active:scale-[0.97] transition-transform",
    icon: "h-3 w-3",
    indicator: "rounded-md",
    indicatorInset: "inset-y-0.5",
    padding: 2,
  },
  md: {
    container: "p-1 rounded-xl gap-1",
    item: "px-3 py-2 text-xs gap-1.5 rounded-lg font-medium active:scale-[0.97] transition-transform",
    icon: "h-3.5 w-3.5",
    indicator: "rounded-lg",
    indicatorInset: "inset-y-1",
    padding: 4,
  },
  lg: {
    container: "p-1.5 rounded-2xl gap-1.5",
    item: "px-5 py-2.5 text-sm gap-2 rounded-xl font-bold active:scale-[0.98] transition-transform",
    icon: "h-4 w-4",
    indicator: "rounded-xl",
    indicatorInset: "inset-y-1.5",
    padding: 6,
  },
} as const;

export const toneIndicatorStyles = {
  neutral: {
    light:
      "bg-white/50 border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] text-slate-900",
    dark: "bg-white/10 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-white",
  },
  accent: {
    light:
      "bg-white/50 border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] text-indigo-700",
    dark: "bg-white/10 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-indigo-300",
  },
  mycountry: {
    light:
      "bg-white/50 border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] text-amber-700",
    dark: "bg-white/10 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-amber-300",
  },
  forum: {
    light:
      "bg-white/50 border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] text-orange-700",
    dark: "bg-white/10 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-orange-300",
  },
  sdi: {
    light: "bg-white/50 border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] text-red-700",
    dark: "bg-white/10 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-red-300",
  },
} as const;

export const toneGlowClasses = {
  neutral: "bg-slate-200/40 dark:bg-white/5",
  accent: "bg-white/20 dark:bg-white/5",
  mycountry: "bg-white/20 dark:bg-white/5",
  forum: "bg-white/20 dark:bg-white/5",
  sdi: "bg-white/20 dark:bg-white/5",
} as const;

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
