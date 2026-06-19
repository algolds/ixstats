"use client";

import React, { useRef, useState } from "react";
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

export function EditorWorkspaceLayout({
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
    e.preventDefault();
    const startY = e.clientY;
    const startRatio = side === "left" ? leftSplitRatio : rightSplitRatio;
    const ref = side === "left" ? leftSidebarRef : rightSidebarRef;
    const containerHeight = ref.current?.getBoundingClientRect().height || 500;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaRatio = deltaY / containerHeight;
      const newRatio = Math.min(0.85, Math.max(0.15, startRatio + deltaRatio));
      if (side === "left") {
        setLeftSplitRatio(newRatio);
      } else {
        setRightSplitRatio(newRatio);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleHorizontalSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = bottomSplitRatio;
    const containerWidth = bottomDockRef.current?.getBoundingClientRect().width || 800;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaRatio = deltaX / containerWidth;
      const newRatio = Math.min(0.85, Math.max(0.15, startRatio + deltaRatio));
      setBottomSplitRatio(newRatio);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

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
        <div
          className={`bg-card/75 border-border flex h-full shrink-0 flex-col backdrop-blur-md ${side === "left" ? "border-r" : "border-l"}`}
        >
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
            className="h-1 w-full shrink-0 cursor-row-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
            onMouseDown={handleVerticalSplitResize(side)}
          />
        ) : (
          <div className="bg-border h-px w-full shrink-0" />
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
        <div className="bg-card/75 border-border flex w-full shrink-0 flex-row gap-2 border-t px-2 py-1 backdrop-blur-md">
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
            className="h-full w-1 shrink-0 cursor-col-resize bg-neutral-200 transition-colors hover:bg-blue-500/50 dark:bg-neutral-800 dark:hover:bg-blue-500/50"
            onMouseDown={handleHorizontalSplitResize}
          />
        ) : (
          <div className="bg-border h-full w-px shrink-0" />
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
          className="hidden h-full shrink-0 sm:flex"
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
            className="bg-card/40 hidden w-full shrink-0 flex-row backdrop-blur-md sm:flex"
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
          className="hidden h-full shrink-0 sm:flex"
        >
          {renderSidePanelContent("right")}
        </div>
      )}
    </div>
  );
}
