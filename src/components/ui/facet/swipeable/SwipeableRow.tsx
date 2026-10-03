"use client";

/**
 * SwipeableRow: iOS-style swipeable row with an action tray. Compound API:
 * `SwipeableRow.Leading` / `.Trailing` (swipe actions, optional `commit`), `.Content`,
 * `.Expanded`; wrap several rows in `SwipeableGroup` to close the others on open.
 *
 * Swiping is pointer-only. Keyboard and assistive technology: a row with no focusable content is
 * itself the tab stop (Enter/Space toggle `Expanded` or open the actions menu, Delete/Backspace run
 * the trailing commit, Escape closes); Shift+F10 or the ContextMenu key opens an "Actions" menu
 * listing the swipe actions. Tray buttons stay in the accessibility tree but out of the tab order.
 */

import React, {
  type ReactNode,
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

// Focus helpers

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

// Actions menu model

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

// Group Context

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

// Row Internal Context

interface RowInternalContextValue {
  physics: ReturnType<typeof useSwipePhysics>;
  isExpanded: boolean;
  toggleExpand: () => void;
  isCommitting: boolean;
  springPreset: SpringPreset;
  /** Whether a click on the content toggles the expanded state. */
  canExpand: boolean;
  hasLeading: boolean;
  hasTrailing: boolean;
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

type TrayElement = React.ReactElement<{
  children?: React.ReactNode;
  commit?: SwipeCommitAction;
}> | null;

/**
 * Keyboard and assistive-technology access to the swipe actions: tab-stop detection, the actions
 * menu (Shift+F10 / ContextMenu) and Enter/Space/Delete/Escape handling.
 */
function useRowKeyboardAccess(args: {
  disabled: boolean;
  leadingChild: TrayElement;
  trailingChild: TrayElement;
  onCommit: SwipeableRowProps["onCommit"];
  hasExpandedContent: boolean;
  isExpanded: boolean;
  toggleExpand: () => void;
  collapse: () => void;
  physics: ReturnType<typeof useSwipePhysics>;
  runCommit: (side: "leading" | "trailing", commit: SwipeCommitAction) => void;
}) {
  const {
    disabled,
    leadingChild,
    trailingChild,
    onCommit,
    hasExpandedContent,
    isExpanded,
    toggleExpand,
    collapse,
    physics,
    runCommit,
  } = args;

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

  return {
    menuActions,
    hasMenu,
    menuOpen,
    setMenuOpen,
    returnFocusRef,
    rowFocusable,
    trailingCommit,
    setContentEl,
    handleKeyDown,
    handleContextMenu,
  };
}

/** Keyboard / assistive-technology path to the swipe actions (an anchor-less dropdown menu). */
function RowActionsMenu({
  actions,
  open,
  onOpenChange,
  label,
  returnFocusRef,
}: {
  actions: RowMenuAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  returnFocusRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden="true"
          data-swipe-menu-anchor=""
          className="pointer-events-none absolute top-1/2 right-3 size-px"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        aria-label={label}
        aria-labelledby={undefined}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current;
          returnFocusRef.current = null;
          event.preventDefault();
          if (target?.isConnected) target.focus();
        }}
      >
        {actions.map(({ key, ariaLabel, icon: Icon, label: text, run }) => (
          <DropdownMenuItem key={key} aria-label={ariaLabel} onSelect={() => run()}>
            {Icon && (
              <span aria-hidden="true" className="flex">
                <Icon className="size-4" />
              </span>
            )}
            {text}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// SwipeableRow (Root)

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
  const [commitColor, setCommitColor] = useState<string | null>(null);
  const [isGulped, setIsGulped] = useState(false);

  /** Gulp animation, then run the commit action. */
  const runCommit = useCallback(
    (side: "leading" | "trailing", commit: SwipeCommitAction) => {
      setIsCommitting(true);
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

  const collapse = useCallback(() => {
    if (!isExpanded) return;
    if (controlledExpanded === undefined) setInternalExpanded(false);
    onExpandedChange?.(false);
  }, [isExpanded, controlledExpanded, onExpandedChange]);

  const {
    menuActions,
    hasMenu,
    menuOpen,
    setMenuOpen,
    returnFocusRef,
    rowFocusable,
    trailingCommit,
    setContentEl,
    handleKeyDown,
    handleContextMenu,
  } = useRowKeyboardAccess({
    disabled,
    leadingChild,
    trailingChild,
    onCommit,
    hasExpandedContent,
    isExpanded,
    toggleExpand,
    collapse,
    physics,
    runCommit,
  });

  const contextValue: RowInternalContextValue = {
    physics,
    isExpanded,
    toggleExpand,
    isCommitting,
    springPreset,
    canExpand,
    hasLeading,
    hasTrailing,
    containerWidth: containerWidth || 300,
    setContentEl,
  };

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
                  className="rounded-row pointer-events-none absolute inset-0 z-30"
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

            {hasMenu && (
              <RowActionsMenu
                actions={menuActions}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                label={actionsLabel}
                returnFocusRef={returnFocusRef}
              />
            )}
          </RowInternalContext.Provider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The action tray behind the content: it grows with the swipe distance on its side. */
function SwipeTray({
  side,
  children,
  className,
}: {
  side: "leading" | "trailing";
  children: ReactNode;
  className?: string;
}) {
  const { physics, containerWidth } = useRowInternal();
  const { springX, leadingTrayOpacity, trailingTrayOpacity } = physics;
  const sign = side === "leading" ? 1 : -1;

  // Width follows the drag distance on this side (clamped to the container); the border only shows once open
  const width = useTransform(springX, (v) => Math.max(0, Math.min(containerWidth, sign * v)));
  const borderWidth = useTransform(springX, (v) => (sign * v > 0 ? "1px" : "0px"));
  const total = React.Children.count(children);
  const actions = React.Children.map(children, (child, idx) =>
    React.isValidElement<Record<string, unknown>>(child)
      ? React.cloneElement(child, { _index: idx, _total: total, _side: side })
      : child
  );

  return (
    <motion.div
      data-swipe-tray={side}
      className={cn(
        "bg-surface-secondary border-separator absolute inset-y-0 z-0 flex items-center overflow-hidden",
        side === "leading" ? "left-0 justify-start border-r" : "right-0 justify-end border-l",
        className
      )}
      style={{
        width,
        ...(side === "leading"
          ? { borderRightWidth: borderWidth }
          : { borderLeftWidth: borderWidth }),
        opacity: side === "leading" ? leadingTrayOpacity : trailingTrayOpacity,
      }}
      role="group"
      aria-label={side === "leading" ? "Leading actions" : "Trailing actions"}
    >
      {/* Action triggers over the tray's opaque inset surface (content, not chrome: no glass) */}
      <div
        className={cn(
          "relative z-20 flex h-full w-full items-center gap-0.5 px-1",
          side === "leading" ? "justify-start" : "justify-end"
        )}
      >
        {actions}
      </div>
    </motion.div>
  );
}

function SwipeableRowLeading({ children, className }: SwipeableRowLeadingProps) {
  return (
    <SwipeTray side="leading" className={className}>
      {children}
    </SwipeTray>
  );
}

function SwipeableRowTrailing({ children, className }: SwipeableRowTrailingProps) {
  return (
    <SwipeTray side="trailing" className={className}>
      {children}
    </SwipeTray>
  );
}

// SwipeableRow.Content

function SwipeableRowContent({ children, className }: SwipeableRowContentProps) {
  const {
    physics,
    toggleExpand,
    isCommitting,
    springPreset,
    containerWidth,
    hasLeading,
    hasTrailing,
    canExpand,
    setContentEl,
  } = useRowInternal();
  const { springX, handlers, wasDrag, settle, thresholdsPx } = physics;

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

// SwipeableRow.Expanded

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

// SwipeActionButton

// Helper mapping Tailwind colors to tinted swipe-action styles
/**
 * Named swipe-action colours → a system colour's tinted fill (15%, its `-ink` text, AA on every
 * background — token-contrast.test.ts). Legacy Tailwind palette names map to the nearest system
 * colour. Written out in full so Tailwind sees every class.
 */
const SWIPE_TONES: Record<string, string> = {
  red: "bg-red/15 hover:bg-red/25 border border-red/20 text-red-ink",
  orange: "bg-orange/15 hover:bg-orange/25 border border-orange/20 text-orange-ink",
  yellow: "bg-yellow/15 hover:bg-yellow/25 border border-yellow/20 text-yellow-ink",
  green: "bg-green/15 hover:bg-green/25 border border-green/20 text-green-ink",
  mint: "bg-mint/15 hover:bg-mint/25 border border-mint/20 text-mint-ink",
  teal: "bg-teal/15 hover:bg-teal/25 border border-teal/20 text-teal-ink",
  cyan: "bg-cyan/15 hover:bg-cyan/25 border border-cyan/20 text-cyan-ink",
  blue: "bg-blue/15 hover:bg-blue/25 border border-blue/20 text-blue-ink",
  indigo: "bg-indigo/15 hover:bg-indigo/25 border border-indigo/20 text-indigo-ink",
  purple: "bg-purple/15 hover:bg-purple/25 border border-purple/20 text-purple-ink",
  pink: "bg-pink/15 hover:bg-pink/25 border border-pink/20 text-pink-ink",
  brown: "bg-brown/15 hover:bg-brown/25 border border-brown/20 text-brown-ink",
  gray: "bg-gray/15 hover:bg-gray/25 border border-gray/20 text-gray-ink",
};
const SWIPE_TONE_ALIASES: Record<string, string> = {
  emerald: "mint",
  amber: "orange",
  slate: "gray",
  zinc: "gray",
  sky: "cyan",
  violet: "purple",
  rose: "pink",
  destructive: "red",
  warning: "orange",
  caution: "yellow",
  success: "green",
  info: "blue",
};

function swipeTone(color: string): string {
  return SWIPE_TONES[SWIPE_TONE_ALIASES[color] ?? color] ?? SWIPE_TONES.gray!;
}

const ACTION_BUTTON_BASE =
  "relative flex h-full flex-col items-center justify-center gap-1 px-3 transition-colors active:brightness-95 overflow-hidden whitespace-nowrap";

/** Tinted-fill classes plus the CSS variable a raw CSS colour feeds (via color-mix: 12% fill, ink pulled 20% toward the label). */
function actionButtonStyle(color: string) {
  const isCssColor = /^(#|rgb|hsl|var\()/.test(color);
  return {
    className: isCssColor
      ? "bg-[color-mix(in_srgb,var(--btn-color)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--btn-color)_22%,transparent)] border border-[color-mix(in_srgb,var(--btn-color)_20%,transparent)] text-[color-mix(in_srgb,var(--btn-color)_80%,var(--color-label))]"
      : swipeTone(color),
    cssVars: isCssColor ? ({ "--btn-color": color } as React.CSSProperties) : undefined,
  };
}

const ActionBody = ({ icon: Icon, label }: Pick<SwipeActionButtonProps, "icon" | "label">) => (
  <>
    <Icon aria-hidden="true" className="size-4 shrink-0" />
    <span className="text-caption truncate font-semibold">{label}</span>
  </>
);

type TrayItemProps = { _index?: number; _total?: number; _side?: "leading" | "trailing" };

export function SwipeActionButton(props: SwipeActionButtonProps & TrayItemProps) {
  const { _index, _total, _side, ...buttonProps } = props;
  const inTray =
    useContext(RowInternalContext) && _index !== undefined && _total !== undefined && _side;
  return inTray ? (
    <TrayActionButton {...buttonProps} index={_index!} total={_total!} side={_side!} />
  ) : (
    <StaticActionButton {...buttonProps} />
  );
}

/** Outside a swipeable row: a plain fixed-width button. */
function StaticActionButton({
  id,
  icon,
  label,
  onClick,
  color,
  "aria-label": ariaLabel,
  className,
}: SwipeActionButtonProps) {
  const { className: tone, cssVars } = actionButtonStyle(color);
  return (
    <button
      data-swipe-action={id}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(ACTION_BUTTON_BASE, tone, className)}
      style={{ ...cssVars, width: "68px", minHeight: "100%" }}
      aria-label={ariaLabel ?? label}
    >
      <ActionBody icon={icon} label={label} />
    </button>
  );
}

/** Inside a tray: slides, scales and fades with the swipe; the primary action grows to fill the tray. */
function TrayActionButton({
  id,
  icon,
  label,
  onClick,
  color,
  "aria-label": ariaLabel,
  className,
  index,
  total,
  side,
}: SwipeActionButtonProps & { index: number; total: number; side: "leading" | "trailing" }) {
  const { className: tone, cssVars } = actionButtonStyle(color);
  const { springX, thresholdsPx } = useRowInternal().physics;
  const { reveal, emphasize, commit } = thresholdsPx;
  const sign = side === "leading" ? 1 : -1;
  const isPrimary = side === "leading" ? index === 0 : index === total - 1;

  // The other buttons stack under the primary one and slide out as the tray opens
  const shiftAmount = side === "trailing" ? (total - 1 - index) * 68 : -index * 68;
  const x = useTransform(springX, [0, sign * reveal, sign * commit], [shiftAmount, 0, 0]);

  // Secondary buttons shrink away past the emphasize point, the primary one grows slightly
  const scale = useTransform(
    springX,
    (isPrimary ? [0, reveal, emphasize, commit] : [0, reveal, emphasize, emphasize + 20]).map(
      (v) => sign * v
    ),
    isPrimary ? [0.5, 1.0, 1.0, 1.15] : [0.5, 1.0, 1.0, 0.0]
  );
  const opacity = useTransform(
    springX,
    (isPrimary
      ? [0, reveal * 0.5, reveal]
      : side === "trailing"
        ? [0, reveal * 0.5, reveal, emphasize, emphasize + 20]
        : [0, reveal, emphasize, emphasize + 20]
    ).map((v) => sign * v),
    isPrimary ? [0, 0.5, 1.0] : [0, 0.5, 1.0, 1.0, 0.0]
  );
  const secondaryWidth = useTransform(
    springX,
    [0, emphasize, emphasize + 20].map((v) => sign * v),
    [68, 68, 0]
  );

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
      className={cn(ACTION_BUTTON_BASE, tone, className)}
      style={{
        ...cssVars,
        x,
        scale,
        opacity,
        width: isPrimary ? "68px" : secondaryWidth,
        minWidth: isPrimary ? "68px" : secondaryWidth,
        flexGrow: isPrimary ? 1 : 0,
        minHeight: "100%",
      }}
      aria-label={ariaLabel ?? label}
    >
      <ActionBody icon={icon} label={label} />
    </motion.button>
  );
}

// Compound Component Assembly

// Attach sub-components to the root
const SwipeableRow = Object.assign(SwipeableRowRoot, {
  Leading: SwipeableRowLeading,
  Trailing: SwipeableRowTrailing,
  Content: SwipeableRowContent,
  Expanded: SwipeableRowExpanded,
});

export { SwipeableRow };

// Internal Utilities

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
