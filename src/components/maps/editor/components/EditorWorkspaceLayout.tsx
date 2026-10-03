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

export const EditorWorkspaceLayout = memo(function EditorWorkspaceLayout({
  panelConfigs,
  panelsLocked,
  toolsDisabled,
  isWorldMode,
  panelA,
  panelB,
  children,
}: EditorWorkspaceLayoutProps) {
  const [leftSplitRatio, setLeftSplitRatio] = useState(0.5);
  const [rightSplitRatio, setRightSplitRatio] = useState(0.5);
  const [bottomSplitRatio, setBottomSplitRatio] = useState(0.5);

  const leftSidebarRef = useRef<HTMLDivElement>(null);
  const rightSidebarRef = useRef<HTMLDivElement>(null);
  const bottomDockRef = useRef<HTMLDivElement>(null);

  const handleVerticalSplitResize = (side: "left" | "right") => (e: React.MouseEvent) => {
    const isLeft = side === "left";
    const ref = isLeft ? leftSidebarRef : rightSidebarRef;
    startSplitDrag(
      e,
      "y",
      isLeft ? leftSplitRatio : rightSplitRatio,
      ref.current?.getBoundingClientRect().height || 500,
      isLeft ? setLeftSplitRatio : setRightSplitRatio
    );
  };

  const handleHorizontalSplitResize = (e: React.MouseEvent) =>
    startSplitDrag(
      e,
      "x",
      bottomSplitRatio,
      bottomDockRef.current?.getBoundingClientRect().width || 800,
      setBottomSplitRatio
    );

  const renderSidePanelContent = (side: "left" | "right") => {
    const isSideA = panelConfigs.panelA.placement === side;
    const isSideB = panelConfigs.panelB.placement === side;

    if (!isSideA && !isSideB) return null;

    if (isSideA && !isSideB) {
      return (
        <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-A`}>
          {panelA}
        </EditorErrorBoundary>
      );
    }

    if (isSideB && !isSideA) {
      return (
        <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-B`}>
          {panelB}
        </EditorErrorBoundary>
      );
    }

    // Both panelA and panelB are stacked on the same side
    const collapsedA = panelConfigs.panelA.collapsed;
    const collapsedB = panelConfigs.panelB.collapsed;
    const splitRatio = side === "left" ? leftSplitRatio : rightSplitRatio;

    if (collapsedA && collapsedB) {
      return (
        <div className="flex h-full shrink-0 flex-col">
          <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-A`}>
            {panelA}
          </EditorErrorBoundary>
          <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-B`}>
            {panelB}
          </EditorErrorBoundary>
        </div>
      );
    }

    if (collapsedA) {
      return (
        <div className="flex h-full shrink-0 flex-col">
          <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-A`}>
            {panelA}
          </EditorErrorBoundary>
          <div className="min-h-0 w-full flex-1">
            <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-B`}>
              {panelB}
            </EditorErrorBoundary>
          </div>
        </div>
      );
    }

    if (collapsedB) {
      return (
        <div className="flex h-full shrink-0 flex-col">
          <div className="min-h-0 w-full flex-1">
            <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-A`}>
              {panelA}
            </EditorErrorBoundary>
          </div>
          <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-B`}>
            {panelB}
          </EditorErrorBoundary>
        </div>
      );
    }

    // Both expanded: resizable vertical split
    return (
      <div className="flex h-full shrink-0 flex-col">
        <div
          style={{ height: `calc(${splitRatio * 100}% - 2px)` }}
          className="min-h-0 w-full shrink-0"
        >
          <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-A`}>
            {panelA}
          </EditorErrorBoundary>
        </div>
        {!panelsLocked ? (
          <div
            className="bg-separator hover:bg-blue/50 h-1 w-full shrink-0 cursor-row-resize transition-colors"
            onMouseDown={handleVerticalSplitResize(side)}
          />
        ) : (
          <div className="bg-separator h-px w-full shrink-0" />
        )}
        <div className="min-h-0 w-full flex-1">
          <EditorErrorBoundary name={`${side === "left" ? "Left" : "Right"}Panel-B`}>
            {panelB}
          </EditorErrorBoundary>
        </div>
      </div>
    );
  };

  const renderBottomDockContent = () => {
    const isBottomA = panelConfigs.panelA.placement === "bottom";
    const isBottomB = panelConfigs.panelB.placement === "bottom";

    if (!isBottomA && !isBottomB) return null;

    if (isBottomA && !isBottomB) {
      return <EditorErrorBoundary name="BottomPanel-A">{panelA}</EditorErrorBoundary>;
    }

    if (isBottomB && !isBottomA) {
      return <EditorErrorBoundary name="BottomPanel-B">{panelB}</EditorErrorBoundary>;
    }

    // Both stacked at bottom
    const collapsedA = panelConfigs.panelA.collapsed;
    const collapsedB = panelConfigs.panelB.collapsed;

    if (collapsedA && collapsedB) {
      return (
        <div className="flex w-full shrink-0 flex-row gap-2 px-2 py-1">
          <EditorErrorBoundary name="BottomPanel-A">{panelA}</EditorErrorBoundary>
          <EditorErrorBoundary name="BottomPanel-B">{panelB}</EditorErrorBoundary>
        </div>
      );
    }

    if (collapsedA) {
      return (
        <div className="flex w-full shrink-0 flex-row items-center">
          <div className="mr-2 shrink-0">
            <EditorErrorBoundary name="BottomPanel-A">{panelA}</EditorErrorBoundary>
          </div>
          <div className="h-full min-w-0 flex-1">
            <EditorErrorBoundary name="BottomPanel-B">{panelB}</EditorErrorBoundary>
          </div>
        </div>
      );
    }

    if (collapsedB) {
      return (
        <div className="flex w-full shrink-0 flex-row items-center">
          <div className="h-full min-w-0 flex-1">
            <EditorErrorBoundary name="BottomPanel-A">{panelA}</EditorErrorBoundary>
          </div>
          <div className="ml-2 shrink-0">
            <EditorErrorBoundary name="BottomPanel-B">{panelB}</EditorErrorBoundary>
          </div>
        </div>
      );
    }

    // Both bottom expanded: horizontal resizable split
    return (
      <div className="flex w-full shrink-0 flex-row">
        <div
          style={{ width: `calc(${bottomSplitRatio * 100}% - 2px)` }}
          className="h-full min-w-0 shrink-0"
        >
          <EditorErrorBoundary name="BottomPanel-A">{panelA}</EditorErrorBoundary>
        </div>
        {!panelsLocked ? (
          <div
            className="bg-separator hover:bg-blue/50 h-full w-1 shrink-0 cursor-col-resize transition-colors"
            onMouseDown={handleHorizontalSplitResize}
          />
        ) : (
          <div className="bg-separator h-full w-px shrink-0" />
        )}
        <div className="h-full min-w-0 flex-1">
          <EditorErrorBoundary name="BottomPanel-B">{panelB}</EditorErrorBoundary>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-row overflow-hidden">
      {/* Left panel slot */}
      {(!toolsDisabled || isWorldMode) && (
        <div
          ref={leftSidebarRef}
          data-testid="editor-panel-A"
          className="pointer-events-auto hidden h-full shrink-0 sm:flex"
        >
          {renderSidePanelContent("left")}
        </div>
      )}

      {/* Center slot (Canvas + Bottom panels) */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        {/* Map canvas */}
        <div className="relative min-h-0 min-w-0 flex-1" data-map-container>
          {children}
        </div>

        {/* Bottom panel slot */}
        {(!toolsDisabled || isWorldMode) && (
          <div
            ref={bottomDockRef}
            className="pointer-events-auto hidden w-full shrink-0 flex-row sm:flex"
          >
            {renderBottomDockContent()}
          </div>
        )}
      </div>

      {/* Right panel slot */}
      {(!toolsDisabled || isWorldMode) && (
        <div
          ref={rightSidebarRef}
          data-testid="editor-panel-B"
          className="pointer-events-auto hidden h-full shrink-0 sm:flex"
        >
          {renderSidePanelContent("right")}
        </div>
      )}
    </div>
  );
});
