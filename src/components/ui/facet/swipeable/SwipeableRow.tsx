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
 *
 * Keyboard and assistive technology (swiping is pointer-only):
 * - The row adds no tab stop when its content has a focusable element (a FacetRow's button or
 *   link); Tab lands on that element and Enter/Space activate it as usual. A row whose content
 *   has nothing focusable is itself the tab stop: Enter/Space toggle `Expanded` (or open the
 *   actions menu), Delete/Backspace run the trailing commit, Escape closes.
 * - Shift+F10 or the ContextMenu key, from the row or anything inside it, opens an "Actions"
 *   menu listing the swipe actions (and commit actions without a matching button) by the same
 *   labels. Focus returns to where it was when the menu closes.
 * - Tray buttons stay in the accessibility tree (screen readers can activate them in browse
 *   mode) but are out of the tab order.
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
import { cn } from "~/lib/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useSwipePhysics } from "./useSwipePhysics";
import { GULP_SCALE, SPRING_PRESETS } from "./constants";

/**
 * Lightweight native measure hook replacing react-use-measure
 */
function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [element, setElement] = useState<T | null>(null);

  const ref = useCallback((node: T | null) => {
    setElement(node);
    if (node) {
      const rect = node.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    }
  }, []);

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setBounds({ width, height });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, bounds] as const;
}
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
  SwipeCommitAction,
} from "./types";

// ── Focus helpers ───────────────────────────────────────────────────────

/** Elements that take keyboard focus on their own. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Elements that own their clicks (the row must not also expand or reveal on them). */
const INTERACTIVE_SELECTOR = `${FOCUSABLE_SELECTOR},[role='button'],[role='link'],[role='checkbox'],[role='switch'],label`;

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file"].includes(
      target.type
    );
  }
  return false;
}

// ── Actions menu model ──────────────────────────────────────────────────

interface RowMenuAction {
  key: string;
  label: string;
  ariaLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  run: () => void;
}

/**
 * The swipe actions as menu items: each tray's action buttons (by the same label and
 * aria-label), then its commit action unless a button already carries that label.
 */
function collectMenuActions(
  trays: Array<
    [
      "leading" | "trailing",
      React.ReactElement<{ children?: React.ReactNode; commit?: SwipeCommitAction }> | null,
    ]
  >,
  onCommit: ((side: "leading" | "trailing") => void) | undefined
): RowMenuAction[] {
  const actions: RowMenuAction[] = [];
  const seen = new Set<string>();
  const add = (action: RowMenuAction) => {
    if (seen.has(action.label)) return;
    seen.add(action.label);
    actions.push(action);
  };
  for (const [side, tray] of trays) {
    if (!tray) continue;
    React.Children.forEach(tray.props.children, (child) => {
      if (!React.isValidElement<Partial<SwipeActionButtonProps>>(child)) return;
      const { id, label, onClick, icon, "aria-label": ariaLabel } = child.props;
      if (typeof label !== "string" || typeof onClick !== "function") return;
      add({ key: `${side}:${id ?? label}`, label, ariaLabel, icon, run: onClick });
    });
    const commit = tray.props.commit;
    if (commit) {
      add({
        key: `${side}:commit`,
        label: commit.label,
        icon: commit.icon,
        run: () => {
          commit.action();
          onCommit?.(side);
        },
      });
    }
  }
  return actions;
}

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
  /** Whether a click on the content toggles the expanded state. */
  canExpand: boolean;
  containerWidth: number;
  /** Ref callback for the content card (used to find focusable content). */
  setContentEl: (el: HTMLDivElement | null) => void;
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
  "aria-label": ariaLabel,
  actionsLabel = "Actions",
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
  const hasExpandedContent = !!expandedChild;
  // Rows without an `Expanded` panel only track "expanded" when the consumer controls it.
  const canExpand = hasExpandedContent || controlledExpanded !== undefined;

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

  /** Gulp animation, then run the commit action. */
  const runCommit = useCallback(
    (side: "leading" | "trailing", commit: SwipeCommitAction) => {
      setIsCommitting(true);
      setCommitSide(side);
      setCommitColor(commit.color ?? (side === "trailing" ? "var(--color-error)" : "#22c55e"));
      setTimeout(() => {
        commit.action();
        onCommit?.(side);
        setIsGulped(true);
      }, 350);
    },
    [onCommit]
  );

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
          runCommit(side, commitAction);
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

  // ── Keyboard & assistive-technology access ──────────────────────────

  const menuActions = collectMenuActions(
    [
      ["leading", leadingChild],
      ["trailing", trailingChild],
    ],
    onCommit
  );
  const hasMenu = menuActions.length > 0;
  const trailingCommit = trailingChild?.props?.commit;

  // The row is a tab stop only when its content has nothing focusable of its own.
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const [contentHasFocusable, setContentHasFocusable] = useState(true);
  useEffect(() => {
    if (!contentEl) return;
    const check = () => setContentHasFocusable(!!contentEl.querySelector(FOCUSABLE_SELECTOR));
    check();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(check);
    observer.observe(contentEl, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled", "tabindex", "href", "contenteditable", "type"],
    });
    return () => observer.disconnect();
  }, [contentEl]);
  const rowFocusable =
    !disabled && !contentHasFocusable && (hasMenu || hasExpandedContent || !!trailingCommit);

  // Actions menu (Shift+F10 / ContextMenu key)
  const [menuOpen, setMenuOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const menuOpenedAt = useRef(0);
  const openMenu = useCallback(
    (from: HTMLElement | null) => {
      returnFocusRef.current = from;
      menuOpenedAt.current = Date.now();
      physics.reset();
      setMenuOpen(true);
    },
    [physics]
  );

  const collapse = useCallback(() => {
    if (!isExpanded) return;
    if (controlledExpanded === undefined) setInternalExpanded(false);
    onExpandedChange?.(false);
  }, [isExpanded, controlledExpanded, onExpandedChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    // Opening the actions menu works from the row and from anything inside it (except text
    // fields, which keep the browser's own context menu).
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      if (!hasMenu || isTextEntry(e.target)) return;
      e.preventDefault();
      openMenu(e.target instanceof HTMLElement ? e.target : null);
      return;
    }

    const fromRow = e.target === e.currentTarget;
    const swipedOpen = physics.swipeState.current !== "closed";

    // Escape from inside only closes a swiped-open tray; everything else belongs to the child.
    if (!fromRow) {
      if (e.key === "Escape" && swipedOpen && !e.defaultPrevented) {
        e.preventDefault();
        physics.reset();
      }
      return;
    }

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (hasExpandedContent) toggleExpand();
        else if (hasMenu) openMenu(e.currentTarget);
        break;
      case "Delete":
      case "Backspace":
        if (trailingCommit) {
          e.preventDefault();
          runCommit("trailing", trailingCommit);
        }
        break;
      case "Escape":
        if (swipedOpen || isExpanded) {
          e.preventDefault();
          physics.reset();
          collapse();
        }
        break;
    }
  };

  // Keyboard-invoked context menus also fire a native `contextmenu` event; keep it from
  // showing the browser menu on top of ours.
  const handleContextMenu = (e: React.MouseEvent) => {
    if (menuOpen || Date.now() - menuOpenedAt.current < 1000) e.preventDefault();
  };

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
      canExpand,
      containerWidth: containerWidth || 300,
      setContentEl,
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
      canExpand,
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
          tabIndex={rowFocusable ? 0 : undefined}
          role={rowFocusable || ariaLabel ? "group" : undefined}
          aria-label={ariaLabel}
          aria-expanded={rowFocusable && hasExpandedContent ? isExpanded : undefined}
          aria-keyshortcuts={
            rowFocusable
              ? [hasMenu && "Shift+F10", trailingCommit && "Delete"].filter(Boolean).join(" ") ||
                undefined
              : undefined
          }
          onKeyDown={handleKeyDown}
          onContextMenu={handleContextMenu}
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

            {/* Keyboard / assistive-technology path to the swipe actions */}
            {hasMenu && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <span
                    aria-hidden="true"
                    data-swipe-menu-anchor=""
                    className="pointer-events-none absolute top-1/2 right-3 size-px"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  aria-label={actionsLabel}
                  aria-labelledby={undefined}
                  onCloseAutoFocus={(event) => {
                    const target = returnFocusRef.current;
                    returnFocusRef.current = null;
                    event.preventDefault();
                    if (target?.isConnected) target.focus();
                  }}
                >
                  {menuActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <DropdownMenuItem
                        key={action.key}
                        aria-label={action.ariaLabel}
                        onSelect={() => action.run()}
                      >
                        {Icon ? (
                          <span aria-hidden="true" className="flex">
                            <Icon className="size-4" />
                          </span>
                        ) : null}
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
    if (React.isValidElement<Record<string, unknown>>(child)) {
      return React.cloneElement(child, {
        _index: idx,
        _total: total,
        _side: "leading",
      });
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
    if (React.isValidElement<Record<string, unknown>>(child)) {
      return React.cloneElement(child, {
        _index: idx,
        _total: total,
        _side: "trailing",
      });
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
    springPreset,
    containerWidth,
    settle,
    hasLeading,
    hasTrailing,
    canExpand,
    thresholdsPx,
    setContentEl,
  } = useRowInternal();

  // Capture phase: a click that ends a drag, lands during a commit, or taps a swiped-open row
  // is swallowed before it reaches the content's own buttons and links.
  const handleClickCapture = useCallback(
    (e: React.MouseEvent) => {
      // Keyboard activation (and programmatic clicks) have no pointer gesture behind them.
      if (e.detail === 0) {
        wasDrag.current = false;
        return;
      }

      if (wasDrag.current) {
        wasDrag.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isCommitting) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Tapping a swiped-open row closes it
      if (Math.abs(springX.get()) > 10) {
        e.preventDefault();
        e.stopPropagation();
        settle(0);
      }
    },
    [wasDrag, isCommitting, springX, settle]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isCommitting) return;

      // Clicks on the content's own interactive elements are theirs alone.
      const owner = (e.target as Element).closest?.(INTERACTIVE_SELECTOR);
      if (owner && owner !== e.currentTarget && e.currentTarget.contains(owner)) return;

      // Click on edges to activate swipe (pointer clicks only)
      if (e.detail !== 0) {
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
      }

      if (canExpand) toggleExpand();
    },
    [toggleExpand, isCommitting, settle, hasLeading, hasTrailing, canExpand, thresholdsPx.reveal]
  );

  // Clamp the actual translation to prevent stretching/visual bugs
  const clampedX = useTransform(springX, (v) => {
    return Math.max(-containerWidth, Math.min(containerWidth, v));
  });

  return (
    <motion.div
      ref={setContentEl}
      className={cn("relative z-10 w-full cursor-grab active:cursor-grabbing", className)}
      style={{
        x: clampedX,
        scale: isCommitting ? GULP_SCALE : 1,
      }}
      animate={{
        scale: isCommitting ? GULP_SCALE : 1,
      }}
      transition={{ type: "spring", ...SPRING_PRESETS[springPreset] }}
      onClickCapture={handleClickCapture}
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

// Helper mapping Tailwind colors to tinted swipe-action styles
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
  const isCssColor = /^(#|rgb|hsl|var\()/.test(color);

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
        <span className="truncate text-xs font-bold">{label}</span>
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      data-swipe-action={id}
      // Out of the tab order: keyboard users reach these through the row's actions menu.
      tabIndex={-1}
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
      <span className="truncate text-xs font-bold">{label}</span>
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
function findChild<P = Record<string, unknown>>(
  children: React.ReactNode,
  type: React.ComponentType<P>
): React.ReactElement<P> | null {
  let found: React.ReactElement<P> | null = null;
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<P>(child) && child.type === type) {
      found = child;
    }
  });
  return found;
}
