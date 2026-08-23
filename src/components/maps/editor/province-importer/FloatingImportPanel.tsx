"use client";

/**
 * FloatingImportPanel - Draggable, resizable floating panel for the province
 * import wizard. No overlay — the map behind stays fully visible and interactive.
 */

import React, { useState, useRef, useCallback, memo, useEffect } from "react";
import { Menu as GripVertical } from "iconoir-react";

interface FloatingImportPanelProps {
  children: React.ReactNode;
  onClose: () => void;
}

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 600;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;

export const FloatingImportPanel = memo(function FloatingImportPanel({
  children,
}: FloatingImportPanelProps) {
  // Position and size state
  const [pos, setPos] = useState({ x: 0, y: 16 });
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [initialized, setInitialized] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Resize state
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Initialize position based on container size
  useEffect(() => {
    if (initialized) return;
    const parentEl = document.querySelector("[data-map-container]");
    const rect = parentEl?.getBoundingClientRect() ?? {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    setPos({
      x: Math.max(16, rect.width - DEFAULT_WIDTH - 16),
      y: 16,
    });
    setSize({
      width: DEFAULT_WIDTH,
      height: Math.min(DEFAULT_HEIGHT, rect.height - 32),
    });
    setInitialized(true);
  }, [initialized]);

  // ── Drag handlers ──

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const parentEl = document.querySelector("[data-map-container]");
      const rect = parentEl?.getBoundingClientRect();
      const maxX = (rect?.width ?? window.innerWidth) - size.width;
      const maxY = (rect?.height ?? window.innerHeight) - 100;

      setPos({
        x: Math.max(0, Math.min(maxX, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(maxY, e.clientY - dragOffset.current.y)),
      });
    },
    [dragging, size.width]
  );

  const onDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // ── Resize handlers ──

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: size.width,
        h: size.height,
      };
      setResizing(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [size]
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizing) return;
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      const parentEl = document.querySelector("[data-map-container]");
      const rect = parentEl?.getBoundingClientRect();
      const maxW = (rect?.width ?? window.innerWidth) - pos.x;
      const maxH = (rect?.height ?? window.innerHeight) - pos.y;

      setSize({
        width: Math.max(MIN_WIDTH, Math.min(maxW, resizeStart.current.w + dx)),
        height: Math.max(MIN_HEIGHT, Math.min(maxH, resizeStart.current.h + dy)),
      });
    },
    [resizing, pos]
  );

  const onResizeEnd = useCallback(() => {
    setResizing(false);
  }, []);

  if (!initialized) return null;

  return (
    <div
      className="bg-card/95 ring-border absolute z-20 flex flex-col overflow-hidden rounded-xl shadow-xl ring-1 backdrop-blur-sm"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Drag handle — top bar area */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className={`bg-muted/50 flex h-2.5 shrink-0 cursor-grab items-center justify-center ${
          dragging ? "cursor-grabbing" : ""
        }`}
      >
        <GripVertical className="text-muted-foreground/50 h-3 w-3 rotate-90" />
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

      {/* Resize handle — bottom-right corner */}
      <div
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize"
      >
        <svg
          className="text-muted-foreground/40 absolute right-0.5 bottom-0.5 h-2.5 w-2.5"
          viewBox="0 0 10 10"
        >
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
});
