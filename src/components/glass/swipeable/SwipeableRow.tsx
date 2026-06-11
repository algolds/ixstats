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
import { motion, AnimatePresence, useTransform } from "motion/react";
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

  return (
    <SwipeableGroupContext.Provider value={value}>
      {children}
    </SwipeableGroupContext.Provider>
  );
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
  useEffect(() => {
    const current = physics.swipeState.current;
    if (current !== prevState.current) {
      prevState.current = current;

      if (current === "committing" && !isCommitting) {
        const side = physics.activeSide.current;
        if (!side) return;

        const commitAction = side === "leading"
          ? leadingChild?.props?.commit
          : trailingChild?.props?.commit;

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
            const tray = (e.currentTarget as HTMLElement).querySelector("[data-swipe-tray='trailing']");
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
            const tray = (e.currentTarget as HTMLElement).querySelector("[data-swipe-tray='leading']");
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
        // Frosted glass action tray
        "bg-white/10 backdrop-blur-md",
        "border-r border-white/12",
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),inset_0_-1px_2px_rgba(0,0,0,0.06)]",
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
      <div className="flex h-full items-center gap-0.5 px-1 w-full justify-start">
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
        // Frosted glass action tray
        "bg-white/10 backdrop-blur-md",
        "border-l border-white/12",
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),inset_0_-1px_2px_rgba(0,0,0,0.06)]",
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
      <div className="flex h-full items-center gap-0.5 px-1 w-full justify-end">
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
    [wasDrag, toggleExpand, isCommitting, springX, settle, hasLeading, hasTrailing, thresholdsPx.reveal]
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
  const bgStyle = isCssColor ? { backgroundColor: color } : undefined;
  const bgClass = isCssColor ? "" : `bg-${color}-500 hover:bg-${color}-600`;

  const context = useContext(RowInternalContext);

  // Fallback if not inside SwipeableRow
  if (!context || _index === undefined || _total === undefined || !_side) {
    return (
      <button
        data-swipe-action={id}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "flex h-full flex-col items-center justify-center gap-1 px-3 transition-colors active:brightness-95",
          "text-white font-bold",
          "backdrop-blur-sm overflow-hidden whitespace-nowrap",
          bgClass,
          className
        )}
        style={{
          ...bgStyle,
          width: "68px",
          minHeight: "100%",
        }}
        aria-label={ariaLabel ?? label}
      >
        <Icon className="h-4 w-4" />
        <span className="text-[9px] font-bold">{label}</span>
      </button>
    );
  }

  const { springX, thresholdsPx } = context;
  const revealPx = thresholdsPx.reveal;
  const emphasizePx = thresholdsPx.emphasize;
  const commitPx = thresholdsPx.commit;

  // Let's compute primary button status
  const isPrimary = _side === "leading" ? _index === 0 : _index === _total - 1;

  // Accordion translation
  const shiftAmount = _side === "trailing" ? (_total - 1 - _index) * 68 : -_index * 68;

  // Create springX mappings
  const x = useTransform(
    springX,
    _side === "trailing"
      ? [0, -revealPx, -commitPx]
      : [0, revealPx, commitPx],
    [shiftAmount, 0, 0]
  );

  // Scale and opacity mappings
  const scale = useTransform(
    springX,
    _side === "trailing"
      ? isPrimary
        ? [0, -revealPx, -emphasizePx, -commitPx]
        : [0, -revealPx, -emphasizePx, -emphasizePx - 20]
      : isPrimary
        ? [0, revealPx, emphasizePx, commitPx]
        : [0, revealPx, emphasizePx, emphasizePx + 20],
    isPrimary
      ? [0.5, 1.0, 1.0, 1.15]
      : [0.5, 1.0, 1.0, 0.0]
  );

  const opacity = useTransform(
    springX,
    _side === "trailing"
      ? isPrimary
        ? [0, -revealPx * 0.5, -revealPx]
        : [0, -revealPx * 0.5, -revealPx, -emphasizePx, -emphasizePx - 20]
      : isPrimary
        ? [0, revealPx * 0.5, revealPx]
        : [0, revealPx * 0.5, revealPx, emphasizePx, emphasizePx + 20],
    isPrimary
      ? [0, 0.5, 1.0]
      : [0, 0.5, 1.0, 1.0, 0.0]
  );

  // Width and MinWidth mappings (only shrink non-primary buttons to 0, primary expands via flex-grow)
  const widthTransform = useTransform(
    springX,
    _side === "trailing"
      ? [0, -emphasizePx, -emphasizePx - 20]
      : [0, emphasizePx, emphasizePx + 20],
    [68, 68, 0]
  );

  const width = isPrimary ? "68px" : widthTransform;
  const minWidth = isPrimary ? "68px" : widthTransform;
  const flexGrow = isPrimary ? 1 : 0;

  return (
    <motion.button
      data-swipe-action={id}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 px-3 transition-colors active:brightness-95",
        "text-white font-bold",
        "backdrop-blur-sm overflow-hidden whitespace-nowrap",
        bgClass,
        className
      )}
      style={{
        ...bgStyle,
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
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-[9px] font-bold truncate">{label}</span>
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
