"use client";

import React, { memo, useRef, useState } from "react";
import { EditorErrorBoundary } from "../utils/editor-overlay-helpers";

interface EditorWorkspaceLayoutProps {
  panelConfigs: {
    panelA: { placement: "left" | "right" | "bottom"; collapsed: boolean };
    panelB: { placement: "left" | "right" | "bottom"; collapsed: boolean };
  };
  panelsLocked: boolean;
  toolsDisabled: boolean;
  isWorldMode: boolean;
  panelA: React.ReactNode;
  panelB: React.ReactNode;
  children: React.ReactNode;
}

/** Drags a panel divider along one axis, keeping the split ratio between 15% and 85%. */
function startSplitDrag(
  e: React.MouseEvent,
  axis: "x" | "y",
  startRatio: number,
  containerSize: number,
  setRatio: (ratio: number) => void
) {
  e.preventDefault();
  const start = axis === "x" ? e.clientX : e.clientY;

  const onMouseMove = (moveEvent: MouseEvent) => {
    const delta = (axis === "x" ? moveEvent.clientX : moveEvent.clientY) - start;
    setRatio(Math.min(0.85, Math.max(0.15, startRatio + delta / containerSize)));
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

type Placement = "left" | "right" | "bottom";

interface StackStyle {
  /** Container classes when both panels are collapsed / one is / both are expanded. */
  containers: { bothCollapsed: string; partial: string; expanded: string };
  /** Wrapper for the panel that takes the remaining space. */
  fill: string;
  /** Wrappers for a collapsed panel A / B next to an expanded sibling (none: rendered bare). */
  collapsedA?: string;
  collapsedB?: string;
  /** Wrapper classes for panel A in the expanded split, plus the CSS property its ratio drives. */
  first: string;
  /** Applies the first panel's share of the stack along its axis. */
  size: (css: string) => React.CSSProperties;
  divider: string;
  lockedDivider: string;
}

const STACK_STYLES: Record<"vertical" | "horizontal", StackStyle> = {
  vertical: {
    containers: {
      bothCollapsed: "flex h-full shrink-0 flex-col",
      partial: "flex h-full shrink-0 flex-col",
      expanded: "flex h-full shrink-0 flex-col",
    },
    fill: "min-h-0 w-full flex-1",
    first: "min-h-0 w-full shrink-0",
    size: (height) => ({ height }),
    divider:
      "bg-separator hover:bg-blue/50 h-1 w-full shrink-0 cursor-row-resize transition-colors",
    lockedDivider: "bg-separator h-px w-full shrink-0",
  },
  horizontal: {
    containers: {
      bothCollapsed: "flex w-full shrink-0 flex-row gap-2 px-2 py-1",
      partial: "flex w-full shrink-0 flex-row items-center",
      expanded: "flex w-full shrink-0 flex-row",
    },
    fill: "h-full min-w-0 flex-1",
    collapsedA: "mr-2 shrink-0",
    collapsedB: "ml-2 shrink-0",
    first: "h-full min-w-0 shrink-0",
    size: (width) => ({ width }),
    divider:
      "bg-separator hover:bg-blue/50 h-full w-1 shrink-0 cursor-col-resize transition-colors",
    lockedDivider: "bg-separator h-full w-px shrink-0",
  },
};

interface StackProps {
  style: StackStyle;
  name: string;
  panelA: React.ReactNode;
  panelB: React.ReactNode;
  collapsedA: boolean;
  collapsedB: boolean;
  splitRatio: number;
  panelsLocked: boolean;
  onDividerMouseDown: (e: React.MouseEvent) => void;
}

/** Two panels docked to the same edge: stacked, one collapsed, or split with a draggable divider. */
function PanelStack({
  style,
  name,
  panelA,
  panelB,
  collapsedA,
  collapsedB,
  splitRatio,
  panelsLocked,
  onDividerMouseDown,
}: StackProps) {
  const a = <EditorErrorBoundary name={`${name}-A`}>{panelA}</EditorErrorBoundary>;
  const b = <EditorErrorBoundary name={`${name}-B`}>{panelB}</EditorErrorBoundary>;
  const wrap = (className: string | undefined, node: React.ReactNode) =>
    className ? <div className={className}>{node}</div> : node;

  if (collapsedA && collapsedB) {
    return (
      <div className={style.containers.bothCollapsed}>
        {a}
        {b}
      </div>
    );
  }

  if (collapsedA || collapsedB) {
    return (
      <div className={style.containers.partial}>
        {wrap(collapsedA ? style.collapsedA : style.fill, a)}
        {wrap(collapsedB ? style.collapsedB : style.fill, b)}
      </div>
    );
  }

  return (
    <div className={style.containers.expanded}>
      <div style={style.size(`calc(${splitRatio * 100}% - 2px)`)} className={style.first}>
        {a}
      </div>
      {panelsLocked ? (
        <div className={style.lockedDivider} />
      ) : (
        <div className={style.divider} onMouseDown={onDividerMouseDown} />
      )}
      <div className={style.fill}>{b}</div>
    </div>
  );
}

export const EditorWorkspaceLayout = memo(function EditorWorkspaceLayout({
  panelConfigs,
  panelsLocked,
  toolsDisabled,
  isWorldMode,
  panelA,
  panelB,
  children,
}: EditorWorkspaceLayoutProps) {
  const [splitRatios, setSplitRatios] = useState<Record<Placement, number>>({
    left: 0.5,
    right: 0.5,
    bottom: 0.5,
  });

  const slotRefs: Record<Placement, React.RefObject<HTMLDivElement | null>> = {
    left: useRef<HTMLDivElement>(null),
    right: useRef<HTMLDivElement>(null),
    bottom: useRef<HTMLDivElement>(null),
  };

  const renderSlotContent = (placement: Placement) => {
    const isA = panelConfigs.panelA.placement === placement;
    const isB = panelConfigs.panelB.placement === placement;
    const name = `${placement[0]!.toUpperCase()}${placement.slice(1)}Panel`;

    if (isA && isB) {
      const isBottom = placement === "bottom";
      return (
        <PanelStack
          style={STACK_STYLES[isBottom ? "horizontal" : "vertical"]}
          name={name}
          panelA={panelA}
          panelB={panelB}
          collapsedA={panelConfigs.panelA.collapsed}
          collapsedB={panelConfigs.panelB.collapsed}
          splitRatio={splitRatios[placement]}
          panelsLocked={panelsLocked}
          onDividerMouseDown={(e) => {
            const rect = slotRefs[placement].current?.getBoundingClientRect();
            startSplitDrag(
              e,
              isBottom ? "x" : "y",
              splitRatios[placement],
              (isBottom ? rect?.width : rect?.height) || (isBottom ? 800 : 500),
              (ratio) => setSplitRatios((prev) => ({ ...prev, [placement]: ratio }))
            );
          }}
        />
      );
    }
    if (!isA && !isB) return null;
    return (
      <EditorErrorBoundary name={`${name}-${isA ? "A" : "B"}`}>
        {isA ? panelA : panelB}
      </EditorErrorBoundary>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-row overflow-hidden">
      {(!toolsDisabled || isWorldMode) && (
        <div
          ref={slotRefs.left}
          data-testid="editor-panel-A"
          className="pointer-events-auto hidden h-full shrink-0 sm:flex"
        >
          {renderSlotContent("left")}
        </div>
      )}

      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 min-w-0 flex-1" data-map-container>
          {children}
        </div>

        {(!toolsDisabled || isWorldMode) && (
          <div
            ref={slotRefs.bottom}
            className="pointer-events-auto hidden w-full shrink-0 flex-row sm:flex"
          >
            {renderSlotContent("bottom")}
          </div>
        )}
      </div>

      {(!toolsDisabled || isWorldMode) && (
        <div
          ref={slotRefs.right}
          data-testid="editor-panel-B"
          className="pointer-events-auto hidden h-full shrink-0 sm:flex"
        >
          {renderSlotContent("right")}
        </div>
      )}
    </div>
  );
});
