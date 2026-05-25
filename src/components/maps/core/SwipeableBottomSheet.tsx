"use client";

/**
 * SwipeableBottomSheet - Mobile bottom sheet with swipe-to-dismiss.
 *
 * Wraps content in a bottom-anchored panel with:
 * - Drag handle indicator
 * - Touch swipe-down to dismiss (threshold: 80px)
 * - Smooth translateY feedback during drag
 * - Spring-back animation on release below threshold
 */

import { useRef, useCallback, useState } from "react";

interface SwipeableBottomSheetProps {
  children: React.ReactNode;
  onClose: () => void;
  maxHeight?: string;
}

const DISMISS_THRESHOLD = 80;

export function SwipeableBottomSheet({
  children,
  onClose,
  maxHeight = "60vh",
}: SwipeableBottomSheetProps) {
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
    <div
      className="absolute inset-x-0 bottom-0 z-20 sm:hidden"
      style={{
        animation: dragDelta === 0 && !isDragging ? "slideInUp 0.25s ease-out" : undefined,
      }}
    >
      <div
        className="bg-card rounded-t-2xl shadow-xl"
        style={{
          maxHeight,
          transform: dragDelta > 0 ? `translateY(${dragDelta}px)` : undefined,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
          opacity: dragDelta > DISMISS_THRESHOLD ? 0.6 : 1,
        }}
      >
        {/* Drag handle — touch target for swiping */}
        <div
          className="flex cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bg-border h-1 w-10 rounded-full" />
        </div>
        {children}
      </div>

      <style jsx>{`
        @keyframes slideInUp {
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
