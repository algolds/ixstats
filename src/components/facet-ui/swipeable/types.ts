/**
 * Glass SwipeableRow — TypeScript Interfaces
 *
 * Defines the complete type surface for the compound component API,
 * physics hook, and group coordination context.
 */

import type { ComponentType, ReactNode } from "react";

// ── Action Definitions ──────────────────────────────────────────────────

/** An individual action button rendered in the swipe tray */
export interface SwipeAction {
  /** Unique identifier for this action */
  id: string;
  /** Icon component rendered inside the action button */
  icon: ComponentType<{ className?: string }>;
  /** Label text (used for aria-label and visible text) */
  label: string;
  /** Callback fired when the action button is tapped */
  onClick: () => void;
  /** CSS color value or Tailwind color name for the action background */
  color: string;
  /** Optional override for aria-label (defaults to `label`) */
  "aria-label"?: string;
}

/** The full-swipe commit action definition */
export interface SwipeCommitAction {
  /** Callback fired on full-swipe commit */
  action: () => void;
  /** Label for the commit action (shown during emphasize phase) */
  label: string;
  /** Optional icon shown during the gulp animation */
  icon?: ComponentType<{ className?: string }>;
  /** Color for the gulp flood animation (CSS value) */
  color?: string;
}

// ── Snap Point Thresholds ───────────────────────────────────────────────

/** Configurable snap point thresholds (0-1 percentage of container width) */
export interface SwipeThresholds {
  /** Percentage at which action buttons are revealed (default: 0.20) */
  reveal?: number;
  /** Percentage at which the primary action is emphasized (default: 0.50) */
  emphasize?: number;
  /** Percentage at which full-swipe commit fires (default: 0.85) */
  commit?: number;
}

// ── Spring Preset ───────────────────────────────────────────────────────

export type SpringPreset = "tight" | "bouncy" | "gentle" | "fluid";

// ── Swipe State ─────────────────────────────────────────────────────────

/** The current state of the swipeable row's interaction */
export type SwipeState =
  | "closed"
  | "dragging"
  | "revealing"
  | "emphasized"
  | "committing"
  | "expanded";

/** Which side is currently active during a drag */
export type SwipeSide = "leading" | "trailing" | null;

// ── Component Props ─────────────────────────────────────────────────────

export interface SwipeableRowProps {
  /** Unique identifier for this row (auto-generated if not provided) */
  id?: string;
  /** Additional CSS classes for the root container */
  className?: string;
  /** Spring physics preset (default: "tight") */
  springPreset?: SpringPreset;
  /** Custom snap thresholds (merged with defaults) */
  thresholds?: SwipeThresholds;
  /** Disable all swipe interactions */
  disabled?: boolean;
  /** Callback fired when swipe state changes */
  onSwipeStateChange?: (state: SwipeState) => void;
  /** Callback fired when a full-swipe commit action is executed */
  onCommit?: (side: "leading" | "trailing") => void;
  /** Controlled expanded state (omit for internal management) */
  expanded?: boolean;
  /** Callback fired when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Children (compound component sub-elements) */
  children: ReactNode;
}

// ── Compound Sub-Component Props ────────────────────────────────────────

export interface SwipeableRowLeadingProps {
  /** Action buttons rendered in the leading (right-swipe) tray */
  children: ReactNode;
  /** Full-swipe-right commit action */
  commit?: SwipeCommitAction;
  /** Additional CSS classes for the tray container */
  className?: string;
}

export interface SwipeableRowTrailingProps {
  /** Action buttons rendered in the trailing (left-swipe) tray */
  children: ReactNode;
  /** Full-swipe-left commit action */
  commit?: SwipeCommitAction;
  /** Additional CSS classes for the tray container */
  className?: string;
}

export interface SwipeableRowContentProps {
  /** The main card content rendered in the foreground */
  children: ReactNode;
  /** Additional CSS classes for the content container */
  className?: string;
}

export interface SwipeableRowExpandedProps {
  /** Content rendered below the card when expanded */
  children: ReactNode;
  /** Additional CSS classes for the expanded container */
  className?: string;
}

// ── Group Coordination Context ──────────────────────────────────────────

export interface SwipeableGroupContextValue {
  /** The ID of the currently open (revealed/expanded) row, or null */
  activeRowId: string | null;
  /** Set the active row ID (closes others) */
  setActiveRowId: (id: string | null) => void;
  /** Register a row with the group on mount */
  registerRow: (id: string) => void;
  /** Unregister a row from the group on unmount */
  unregisterRow: (id: string) => void;
}

// ── SwipeAction Component Props (the button inside Leading/Trailing) ────

export interface SwipeActionButtonProps {
  /** Unique identifier for this action */
  id: string;
  /** Icon component */
  icon: ComponentType<{ className?: string }>;
  /** Label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Color for the action button background (Tailwind class or CSS value) */
  color: string;
  /** Optional aria-label override */
  "aria-label"?: string;
  /** Additional CSS classes */
  className?: string;
}
