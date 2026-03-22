"use client";

/**
 * MobileEditorSheet - Bottom sheet for mobile editor panels.
 *
 * Adapts the SwipeableBottomSheet pattern for the map editor's property
 * panel and feature list. Only rendered on mobile (<sm breakpoint).
 *
 * Features:
 * - Swipe-down to dismiss (80px threshold)
 * - Smooth drag feedback with translateY
 * - Backdrop tap to close
 * - Safe area padding for iOS home indicator
 */

import { useRef, useCallback, useState } from "react";

interface MobileEditorSheetProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  maxHeight?: string;
}

const DISMISS_THRESHOLD = 80;

export function MobileEditorSheet({
  children,
  onClose,
  title,
  maxHeight = "70vh",
}: MobileEditorSheetProps) {
  const startYRef = useRef(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startYRef.current = touch.clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = Math.max(0, touch.clientY - startYRef.current);
      setDragDelta(delta);
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragDelta > DISMISS_THRESHOLD) {
      onClose();
    } else {
      setDragDelta(0);
    }
  }, [dragDelta, onClose]);

  return (
    <div className="absolute inset-0 z-30 sm:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Sheet */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          animation:
            dragDelta === 0 && !isDragging
              ? "editorSheetSlideUp 0.25s ease-out"
              : undefined,
        }}
      >
        <div
          className="rounded-t-2xl bg-card shadow-xl"
          style={{
            maxHeight,
            transform: dragDelta > 0 ? `translateY(${dragDelta}px)` : undefined,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
            opacity: dragDelta > DISMISS_THRESHOLD ? 0.6 : 1,
          }}
        >
          {/* Drag handle */}
          <div
            className="flex cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Title bar */}
          {title && (
            <div className="px-4 pb-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
          )}

          {/* Content — scrollable */}
          <div
            className="overflow-y-auto overscroll-contain px-4 pb-8"
            style={{ maxHeight: `calc(${maxHeight} - 3rem)` }}
          >
            {children}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes editorSheetSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
