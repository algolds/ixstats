"use client";

/**
 * SwipeableRow — iOS-style swipeable row with frosted glass action tray
 *
 * Compound component API:
 *   <SwipeableRow>
 *     <SwipeableRow.Leading commit={...}>
 *       <SwipeActionButton ... />
 *     </SwipeableRow.Leading>
 *     <SwipeableRow.Content>
 *       {children}
 *     </SwipeableRow.Content>
 *     <SwipeableRow.Trailing commit={...}>
 *       <SwipeActionButton ... />
 *     </SwipeableRow.Trailing>
 *     <SwipeableRow.Expanded>
 *       {expandedContent}
 *     </SwipeableRow.Expanded>
 *   </SwipeableRow>
 *
 * Wrap multiple rows in <SwipeableGroup> for auto-close coordination.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import useMeasure from "react-use-measure";
import { cn } from "~/lib/utils";
import { useSwipePhysics } from "./useSwipePhysics";
import { GULP_SCALE, SPRING_PRESETS } from "./constants";
import type {
  SwipeableRowProps,
  SwipeableRowLeadingProps,
  SwipeableRowTrailingProps,
  SwipeableRowContentProps,
  SwipeableRowExpandedProps,
  SwipeableGroupContextValue,
  SwipeActionButtonProps,
  SpringPreset,
  SwipeState,
} from "./types";

// ── Group Context ───────────────────────────────────────────────────────

const SwipeableGroupContext = createContext<SwipeableGroupContextValue | null>(null);

export function SwipeableGroup({ children }: { children: React.ReactNode }) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const rowIds = useRef(new Set<string>());

  const registerRow = useCallback((id: string) => {
    rowIds.current.add(id);
  }, []);

  const unregisterRow = useCallback((id: string) => {
    rowIds.current.delete(id);
  }, []);

  // Click outside to close active row
  useEffect(() => {
    if (!activeRowId) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Check if click is inside any registered swipeable row
      const clickedInsideRow = target.closest("[data-swipeable-row]");
      if (!clickedInsideRow) {
        setActiveRowId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, { passive: true });
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeRowId]);

  const value = useMemo(
    () => ({ activeRowId, setActiveRowId, registerRow, unregisterRow }),
    [activeRowId, registerRow, unregisterRow]
  );

  return <SwipeableGroupContext.Provider value={value}>{children}</SwipeableGroupContext.Provider>;
}

// ── Row Internal Context ────────────────────────────────────────────────

interface RowInternalContextValue {
  springX: ReturnType<typeof useSwipePhysics>["springX"];
  trailingTrayOpacity: ReturnType<typeof useSwipePhysics>["trailingTrayOpacity"];
  leadingTrayOpacity: ReturnType<typeof useSwipePhysics>["leadingTrayOpacity"];
  trailingEmphasizeScale: ReturnType<typeof useSwipePhysics>["trailingEmphasizeScale"];
  leadingEmphasizeScale: ReturnType<typeof useSwipePhysics>["leadingEmphasizeScale"];
  trailingProgress: ReturnType<typeof useSwipePhysics>["trailingProgress"];
  leadingProgress: ReturnType<typeof useSwipePhysics>["leadingProgress"];
  isExpanded: boolean;
  toggleExpand: () => void;
  isCommitting: boolean;
  commitSide: "leading" | "trailing" | null;
  commitColor: string | null;
  handlers: ReturnType<typeof useSwipePhysics>["handlers"];
  wasDrag: React.RefObject<boolean>;
  springPreset: SpringPreset;
  thresholdsPx: ReturnType<typeof useSwipePhysics>["thresholdsPx"];
  settle: (targetX: number) => void;
  hasLeading: boolean;
  hasTrailing: boolean;
  containerWidth: number;
}

const RowInternalContext = createContext<RowInternalContextValue | null>(null);

function useRowInternal() {
  const ctx = useContext(RowInternalContext);
  if (!ctx) throw new Error("SwipeableRow sub-components must be used within <SwipeableRow>");
  return ctx;
}

// ── SwipeableRow (Root) ─────────────────────────────────────────────────

function SwipeableRowRoot({
  id: externalId,
  className,
  springPreset = "tight",
  thresholds,
  disabled = false,
  onSwipeStateChange,
  onCommit,
  expanded: controlledExpanded,
  onExpandedChange,
  children,
}: SwipeableRowProps) {
  const generatedId = useId();
  const rowId = externalId ?? generatedId;
  const group = useContext(SwipeableGroupContext);

  // Register with group
  useEffect(() => {
    group?.registerRow(rowId);
    return () => group?.unregisterRow(rowId);
  }, [group, rowId]);

  // Container width measurement
  const [measureRef, { width: containerWidth }] = useMeasure();

  // Extract compound children
  const leadingChild = findChild(children, SwipeableRowLeading);
  const trailingChild = findChild(children, SwipeableRowTrailing);
  const contentChild = findChild(children, SwipeableRowContent);
  const expandedChild = findChild(children, SwipeableRowExpanded);

  const hasLeading = !!leadingChild;
  const hasTrailing = !!trailingChild;

  // Expanded state
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;

  const toggleExpand = useCallback(() => {
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    onExpandedChange?.(next);
    if (next) {
      // When expanding, notify the group
      group?.setActiveRowId(rowId);
    }
  }, [isExpanded, controlledExpanded, onExpandedChange, group, rowId]);

  // Physics
  const physics = useSwipePhysics({
    containerWidth: containerWidth || 300, // fallback for SSR
    springPreset,
    thresholds,
    hasLeading,
    hasTrailing,
    disabled: disabled || isExpanded, // Disable swipe while expanded
    onStateChange: onSwipeStateChange,
  });

  // Commit animation state
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSide, setCommitSide] = useState<"leading" | "trailing" | null>(null);
  const [commitColor, setCommitColor] = useState<string | null>(null);
  const [isGulped, setIsGulped] = useState(false);

  // Watch for commit state from physics
  const prevState = useRef<SwipeState>("closed");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const current = physics.swipeState.current;
    if (current !== prevState.current) {
      prevState.current = current;

      if (current === "committing" && !isCommitting) {
        const side = physics.activeSide.current;
        if (!side) return;

        const commitAction =
          side === "leading" ? leadingChild?.props?.commit : trailingChild?.props?.commit;

        if (commitAction) {
          setIsCommitting(true);
          setCommitSide(side);
          setCommitColor(commitAction.color ?? (side === "trailing" ? "#ef4444" : "#22c55e"));

          // Execute commit after gulp animation
          setTimeout(() => {
            commitAction.action();
            onCommit?.(side);
            setIsGulped(true);
          }, 350);
        } else {
          // No commit action — snap back to reveal
          physics.settle(
            side === "trailing" ? -physics.thresholdsPx.reveal : physics.thresholdsPx.reveal
          );
        }
      }
    }
  });

  // Group coordination: close this row when another opens
  useEffect(() => {
    if (group?.activeRowId && group.activeRowId !== rowId) {
      physics.reset();
      if (controlledExpanded === undefined) {
        setInternalExpanded(false);
      }
    }
  }, [group?.activeRowId, rowId, physics, controlledExpanded]);

  // When revealing, set this row as active in group
  useEffect(() => {
    if (physics.swipeState.current === "revealing" || physics.swipeState.current === "emphasized") {
      group?.setActiveRowId(rowId);
    }
  });

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (expandedChild) {
            toggleExpand();
          }
          break;
        case "Delete":
        case "Backspace": {
          e.preventDefault();
          const trailingCommit = trailingChild?.props?.commit;
          if (trailingCommit) {
            setIsCommitting(true);
            setCommitSide("trailing");
            setCommitColor(trailingCommit.color ?? "#ef4444");
            setTimeout(() => {
              trailingCommit.action();
              onCommit?.("trailing");
              setIsGulped(true);
            }, 350);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          physics.reset();
          if (isExpanded && controlledExpanded === undefined) {
            setInternalExpanded(false);
            onExpandedChange?.(false);
          }
          break;
        case "ArrowLeft":
          if (physics.swipeState.current !== "closed") {
            e.preventDefault();
            // Focus next action button in trailing tray
            const tray = (e.currentTarget as HTMLElement).querySelector(
              "[data-swipe-tray='trailing']"
            );
            const buttons = tray?.querySelectorAll("button");
            if (buttons?.length) {
              const focused = document.activeElement;
              const idx = Array.from(buttons).indexOf(focused as HTMLButtonElement);
              const next = buttons[Math.min(idx + 1, buttons.length - 1)];
              (next as HTMLElement)?.focus();
            }
          }
          break;
        case "ArrowRight":
          if (physics.swipeState.current !== "closed") {
            e.preventDefault();
            const tray = (e.currentTarget as HTMLElement).querySelector(
              "[data-swipe-tray='leading']"
            );
            const buttons = tray?.querySelectorAll("button");
            if (buttons?.length) {
              const focused = document.activeElement;
              const idx = Array.from(buttons).indexOf(focused as HTMLButtonElement);
              const next = buttons[Math.max(idx - 1, 0)];
              (next as HTMLElement)?.focus();
            }
          }
          break;
      }
    },
    [
      disabled,
      expandedChild,
      toggleExpand,
      trailingChild,
      physics,
      isExpanded,
      controlledExpanded,
      onExpandedChange,
      onCommit,
    ]
  );

  const contextValue = useMemo<RowInternalContextValue>(
    () => ({
      springX: physics.springX,
      trailingTrayOpacity: physics.trailingTrayOpacity,
      leadingTrayOpacity: physics.leadingTrayOpacity,
      trailingEmphasizeScale: physics.trailingEmphasizeScale,
      leadingEmphasizeScale: physics.leadingEmphasizeScale,
      trailingProgress: physics.trailingProgress,
      leadingProgress: physics.leadingProgress,
      isExpanded,
      toggleExpand,
      isCommitting,
      commitSide,
      commitColor,
      handlers: physics.handlers,
      wasDrag: physics.wasDrag,
      springPreset,
      thresholdsPx: physics.thresholdsPx,
      settle: physics.settle,
      hasLeading,
      hasTrailing,
      containerWidth: containerWidth || 300,
    }),
    [
      physics.springX,
      physics.trailingTrayOpacity,
      physics.leadingTrayOpacity,
      physics.trailingEmphasizeScale,
      physics.leadingEmphasizeScale,
      physics.trailingProgress,
      physics.leadingProgress,
      isExpanded,
      toggleExpand,
      isCommitting,
      commitSide,
      commitColor,
      physics.handlers,
      physics.wasDrag,
      springPreset,
      physics.thresholdsPx,
      physics.settle,
      hasLeading,
      hasTrailing,
      containerWidth,
    ]
  );

  return (
    <AnimatePresence>
      {!isGulped && (
        <motion.div
          ref={measureRef}
          data-swipeable-row={rowId}
          className={cn("relative overflow-hidden select-none", className)}
          tabIndex={0}
          role="group"
          aria-expanded={isExpanded}
          aria-label="Swipeable row"
          onKeyDown={handleKeyDown}
          layout
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ type: "spring", ...SPRING_PRESETS[springPreset] }}
          style={{ touchAction: "pan-y" }}
        >
          <RowInternalContext.Provider value={contextValue}>
            {/* Commit gulp flood overlay */}
            <AnimatePresence>
              {isCommitting && commitColor && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-30 rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.85 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ backgroundColor: commitColor }}
                />
              )}
            </AnimatePresence>

            {/* Action trays (behind the content card) */}
            {leadingChild}
            {trailingChild}

            {/* Content card (draggable foreground) + Expanded content */}
            {contentChild}
            {expandedChild}
          </RowInternalContext.Provider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── SwipeableRow.Leading ────────────────────────────────────────────────

function SwipeableRowLeading({ children, commit: _commit, className }: SwipeableRowLeadingProps) {
  const { springX, leadingTrayOpacity, containerWidth } = useRowInternal();

  // Dynamic width matching drag distance (only positive values, clamped to containerWidth)
  const leadingWidth = useTransform(springX, (v) => Math.max(0, Math.min(containerWidth, v)));

  // Remove border-r when closed
  const borderRightWidth = useTransform(springX, (v) => (v > 0 ? "1px" : "0px"));

  const childrenArray = React.Children.toArray(children);
  const total = childrenArray.length;
  const processedChildren = React.Children.map(children, (child, idx) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        _index: idx,
        _total: total,
        _side: "leading",
      } as any);
    }
    return child;
  });

  return (
    <motion.div
      data-swipe-tray="leading"
      className={cn(
        "absolute inset-y-0 left-0 z-0 flex items-center justify-start overflow-hidden",
        "border-r border-black/[0.08] dark:border-white/10",
        className
      )}
      style={{
        width: leadingWidth,
        borderRightWidth,
        opacity: leadingTrayOpacity,
      }}
      role="group"
      aria-label="Leading actions"
    >
      {/* 1. Underlying background color & raw sheens (Z-0) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] bg-black/[0.02] dark:bg-gradient-to-br dark:from-white/[0.04] dark:to-white/[0.005]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent dark:via-white/6" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/12 to-transparent dark:via-white/6" />
        </div>
      </div>

      {/* 2. Frosted glass backdrop blur filter layer (Z-10) */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] saturate-[190%] backdrop-blur-[20px]"
        style={{
          WebkitBackdropFilter: "blur(20px) saturate(190%)",
        }}
      />

      {/* 3. Action Triggers container (Z-20) */}
      <div className="relative z-20 flex h-full w-full items-center justify-start gap-0.5 px-1">
        {processedChildren}
      </div>
    </motion.div>
  );
}

// ── SwipeableRow.Trailing ───────────────────────────────────────────────

function SwipeableRowTrailing({ children, commit: _commit, className }: SwipeableRowTrailingProps) {
  const { springX, trailingTrayOpacity, containerWidth } = useRowInternal();

  // Dynamic width matching drag distance (only negative values made positive, clamped to containerWidth)
  const trailingWidth = useTransform(springX, (v) => Math.max(0, Math.min(containerWidth, -v)));

  // Remove border-l when closed
  const borderLeftWidth = useTransform(springX, (v) => (v < 0 ? "1px" : "0px"));

  const childrenArray = React.Children.toArray(children);
  const total = childrenArray.length;
  const processedChildren = React.Children.map(children, (child, idx) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        _index: idx,
        _total: total,
        _side: "trailing",
      } as any);
    }
    return child;
  });

  return (
    <motion.div
      data-swipe-tray="trailing"
      className={cn(
        "absolute inset-y-0 right-0 z-0 flex items-center justify-end overflow-hidden",
        "border-l border-black/[0.08] dark:border-white/10",
        className
      )}
      style={{
        width: trailingWidth,
        borderLeftWidth,
        opacity: trailingTrayOpacity,
      }}
      role="group"
      aria-label="Trailing actions"
    >
      {/* 1. Underlying background color & raw sheens (Z-0) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] bg-black/[0.02] dark:bg-gradient-to-br dark:from-white/[0.04] dark:to-white/[0.005]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent dark:via-white/6" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/18 to-transparent dark:via-white/10" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/12 to-transparent dark:via-white/6" />
        </div>
      </div>

      {/* 2. Frosted glass backdrop blur filter layer (Z-10) */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] saturate-[190%] backdrop-blur-[20px]"
        style={{
          WebkitBackdropFilter: "blur(20px) saturate(190%)",
        }}
      />

      {/* 3. Action Triggers container (Z-20) */}
      <div className="relative z-20 flex h-full w-full items-center justify-end gap-0.5 px-1">
        {processedChildren}
      </div>
    </motion.div>
  );
}

// ── SwipeableRow.Content ────────────────────────────────────────────────

function SwipeableRowContent({ children, className }: SwipeableRowContentProps) {
  const {
    springX,
    handlers,
    wasDrag,
    toggleExpand,
    isCommitting,
    isExpanded,
    springPreset,
    containerWidth,
    settle,
    hasLeading,
    hasTrailing,
    thresholdsPx,
  } = useRowInternal();

  const suppressNextClick = useRef(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (suppressNextClick.current) {
        suppressNextClick.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (wasDrag.current) {
        wasDrag.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Don't expand during commit animation
      if (isCommitting) return;

      // Close if already swiped open
      const currentX = springX.get();
      if (Math.abs(currentX) > 10) {
        e.preventDefault();
        e.stopPropagation();
        settle(0);
        return;
      }

      // Click on edges to activate swipe
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const edgeThreshold = Math.min(48, width * 0.15); // 48px or 15% of width

      if (clickX < edgeThreshold && hasLeading) {
        e.preventDefault();
        e.stopPropagation();
        settle(thresholdsPx.reveal);
        return;
      }

      if (clickX > width - edgeThreshold && hasTrailing) {
        e.preventDefault();
        e.stopPropagation();
        settle(-thresholdsPx.reveal);
        return;
      }

      toggleExpand();
    },
    [
      wasDrag,
      toggleExpand,
      isCommitting,
      springX,
      settle,
      hasLeading,
      hasTrailing,
      thresholdsPx.reveal,
    ]
  );

  // Clamp the actual translation to prevent stretching/visual bugs
  const clampedX = useTransform(springX, (v) => {
    return Math.max(-containerWidth, Math.min(containerWidth, v));
  });

  return (
    <motion.div
      className={cn("relative z-10 w-full cursor-grab active:cursor-grabbing", className)}
      style={{
        x: clampedX,
        scale: isCommitting ? GULP_SCALE : 1,
      }}
      animate={{
        scale: isCommitting ? GULP_SCALE : 1,
      }}
      transition={{ type: "spring", ...SPRING_PRESETS[springPreset] }}
      onClick={handleClick}
      {...handlers}
    >
      {children}
    </motion.div>
  );
}

// ── SwipeableRow.Expanded ───────────────────────────────────────────────

function SwipeableRowExpanded({ children, className }: SwipeableRowExpandedProps) {
  const { isExpanded, springPreset } = useRowInternal();
  const [contentRef, { height: measuredHeight }] = useMeasure();
  const spring = SPRING_PRESETS[springPreset];

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          className={cn("relative z-10 overflow-hidden", className)}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: measuredHeight || "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", ...spring }}
          aria-hidden={!isExpanded}
        >
          <div ref={contentRef}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── SwipeActionButton ───────────────────────────────────────────────────

// Helper mapping Tailwind colors to glass-blended styles
const tailwindColorMap: Record<string, { light: string; dark: string }> = {
  red: {
    light: "bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-700",
    dark: "dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:border-white/10 dark:text-red-300",
  },
  green: {
    light: "bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-700",
    dark: "dark:bg-green-500/15 dark:hover:bg-green-500/25 dark:border-white/10 dark:text-green-300",
  },
  emerald: {
    light:
      "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700",
    dark: "dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:border-white/10 dark:text-emerald-300",
  },
  blue: {
    light: "bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-700",
    dark: "dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:border-white/10 dark:text-blue-300",
  },
  indigo: {
    light: "bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-700",
    dark: "dark:bg-indigo-500/15 dark:hover:bg-indigo-500/25 dark:border-white/10 dark:text-indigo-300",
  },
  amber: {
    light: "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-700",
    dark: "dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:border-white/10 dark:text-amber-300",
  },
  yellow: {
    light: "bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-700",
    dark: "dark:bg-yellow-500/15 dark:hover:bg-yellow-500/25 dark:border-white/10 dark:text-yellow-300",
  },
  slate: {
    light: "bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 text-slate-700",
    dark: "dark:bg-slate-500/15 dark:hover:bg-slate-500/25 dark:border-white/10 dark:text-slate-300",
  },
};

// ── SwipeActionButton ───────────────────────────────────────────────────

export function SwipeActionButton({
  id,
  icon: Icon,
  label,
  onClick,
  color,
  "aria-label": ariaLabel,
  className,
  _index,
  _total,
  _side,
}: SwipeActionButtonProps & { _index?: number; _total?: number; _side?: "leading" | "trailing" }) {
  // Determine if color is a CSS value or a Tailwind class name
  const isCssColor = color.startsWith("#") || color.startsWith("rgb") || color.startsWith("hsl");

  const btnClass = isCssColor
    ? "bg-[color-mix(in_srgb,var(--btn-color)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--btn-color)_22%,transparent)] border border-[color-mix(in_srgb,var(--btn-color)_20%,transparent)] text-[color-mix(in_srgb,var(--btn-color)_85%,#0f172a)] dark:text-[color-mix(in_srgb,var(--btn-color)_85%,#f8fafc)]"
    : tailwindColorMap[color]
      ? `${tailwindColorMap[color].light} ${tailwindColorMap[color].dark}`
      : `bg-${color}-500/10 hover:bg-${color}-500/20 border border-${color}-500/20 text-${color}-700 dark:text-${color}-300 dark:border-white/10 dark:bg-${color}-500/15 dark:hover:bg-${color}-500/25`;

  const inlineStyle = isCssColor ? ({ "--btn-color": color } as React.CSSProperties) : undefined;

  const context = useContext(RowInternalContext);
  const _hasContext = !!(context && _index !== undefined && _total !== undefined && _side);

  // Fallback motion value (used when no context — keeps useTransform hooks unconditional)
  const fallbackSpringX = useMotionValue(0);

  // Safe defaults for hook calls
  const safeIndex = _index ?? 0;
  const safeTotal = _total ?? 1;
  const safeSide: "leading" | "trailing" = _side ?? "leading";
  const springX = context?.springX ?? fallbackSpringX;
  const revealPx = context?.thresholdsPx.reveal ?? 0;
  const emphasizePx = context?.thresholdsPx.emphasize ?? 0;
  const commitPx = context?.thresholdsPx.commit ?? 0;

  // Let's compute primary button status
  const isPrimary = safeSide === "leading" ? safeIndex === 0 : safeIndex === safeTotal - 1;

  // Accordion translation
  const shiftAmount = safeSide === "trailing" ? (safeTotal - 1 - safeIndex) * 68 : -safeIndex * 68;

  // Create springX mappings
  const x = useTransform(
    springX,
    safeSide === "trailing" ? [0, -revealPx, -commitPx] : [0, revealPx, commitPx],
    [shiftAmount, 0, 0]
  );

  // Scale and opacity mappings
  const scale = useTransform(
    springX,
    safeSide === "trailing"
      ? isPrimary
        ? [0, -revealPx, -emphasizePx, -commitPx]
        : [0, -revealPx, -emphasizePx, -emphasizePx - 20]
      : isPrimary
        ? [0, revealPx, emphasizePx, commitPx]
        : [0, revealPx, emphasizePx, emphasizePx + 20],
    isPrimary ? [0.5, 1.0, 1.0, 1.15] : [0.5, 1.0, 1.0, 0.0]
  );

  const opacity = useTransform(
    springX,
    safeSide === "trailing"
      ? isPrimary
        ? [0, -revealPx * 0.5, -revealPx]
        : [0, -revealPx * 0.5, -revealPx, -emphasizePx, -emphasizePx - 20]
      : isPrimary
        ? [0, revealPx * 0.5, revealPx]
        : [0, revealPx, emphasizePx, emphasizePx + 20],
    isPrimary ? [0, 0.5, 1.0] : [0, 0.5, 1.0, 1.0, 0.0]
  );

  // Width and MinWidth mappings (only shrink non-primary buttons to 0, primary expands via flex-grow)
  const widthTransform = useTransform(
    springX,
    safeSide === "trailing"
      ? [0, -emphasizePx, -emphasizePx - 20]
      : [0, emphasizePx, emphasizePx + 20],
    [68, 68, 0]
  );

  const width = isPrimary ? "68px" : widthTransform;
  const minWidth = isPrimary ? "68px" : widthTransform;
  const flexGrow = isPrimary ? 1 : 0;

  // Fallback if not inside SwipeableRow
  if (!_hasContext) {
    return (
      <button
        data-swipe-action={id}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "relative flex h-full flex-col items-center justify-center gap-1 px-3 transition-colors active:brightness-95",
          "overflow-hidden whitespace-nowrap backdrop-blur-sm",
          btnClass,
          className
        )}
        style={{
          ...inlineStyle,
          width: "68px",
          minHeight: "100%",
        }}
        aria-label={ariaLabel ?? label}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent dark:via-white/6" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent dark:via-white/4" />

        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate text-[9px] font-bold">{label}</span>
      </button>
    );
  }

  return (
    <motion.button
      data-swipe-action={id}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative flex h-full flex-col items-center justify-center gap-1 px-3 transition-colors active:brightness-95",
        "overflow-hidden whitespace-nowrap backdrop-blur-sm",
        btnClass,
        className
      )}
      style={{
        ...inlineStyle,
        x,
        scale,
        opacity,
        width,
        minWidth,
        flexGrow,
        minHeight: "100%",
      }}
      aria-label={ariaLabel ?? label}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent dark:via-white/6" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent dark:via-white/4" />

      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate text-[9px] font-bold">{label}</span>
    </motion.button>
  );
}

// ── Compound Component Assembly ─────────────────────────────────────────

// Attach sub-components to the root
const SwipeableRow = Object.assign(SwipeableRowRoot, {
  Leading: SwipeableRowLeading,
  Trailing: SwipeableRowTrailing,
  Content: SwipeableRowContent,
  Expanded: SwipeableRowExpanded,
});

export { SwipeableRow };

// ── Internal Utilities ──────────────────────────────────────────────────

/**
 * Find a specific compound child element by its component type.
 * Returns the element (with props accessible) or null.
 */
function findChild(
  children: React.ReactNode,
  type: React.ComponentType<any>
): React.ReactElement<any> | null {
  let found: React.ReactElement<any> | null = null;
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === type) {
      found = child;
    }
  });
  return found;
}
