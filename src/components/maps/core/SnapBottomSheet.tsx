"use client";

/**
 * SnapBottomSheet — Physics-based bottom sheet with 3 snap positions.
 *
 * Positions:
 * - Peek (~140px): Summary content visible over the map
 * - Half (~50vh): Scrollable content
 * - Full (~90vh): Full tabbed content
 *
 * Gesture physics:
 * - Velocity-based snap (>500px/s fast swipe)
 * - Spring animation via CSS transitions
 * - Inner scroll lock at peek, scrollable at half/full
 * - Swipe down from top of scroll → transitions to sheet drag
 */

import { useRef, useCallback, useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export type SnapPosition = "dismissed" | "peek" | "half" | "full";

interface SnapBottomSheetProps {
  children: React.ReactNode;
  peekContent?: React.ReactNode;
  onClose: () => void;
  initialSnap?: "peek" | "half" | "full";
  peekHeight?: number;
  halfHeight?: string;
  fullHeight?: string;
}

const VELOCITY_THRESHOLD = 500; // px/s — fast swipe
const DRAG_HANDLE_HEIGHT = 48;

function getSnapY(
  snap: SnapPosition,
  windowHeight: number,
  peekHeight: number,
  halfHeight: string,
  fullHeight: string
): number {
  switch (snap) {
    case "dismissed":
      return windowHeight;
    case "peek":
      return windowHeight - peekHeight;
    case "half":
      return windowHeight - parseHeight(halfHeight, windowHeight);
    case "full":
      return windowHeight - parseHeight(fullHeight, windowHeight);
  }
}

function parseHeight(h: string, windowHeight: number): number {
  if (h.endsWith("vh")) return (parseFloat(h) / 100) * windowHeight;
  if (h.endsWith("px")) return parseFloat(h);
  return parseFloat(h);
}

function findClosestSnap(
  y: number,
  velocity: number,
  windowHeight: number,
  peekHeight: number,
  halfHeight: string,
  fullHeight: string
): SnapPosition {
  // Fast swipe overrides position
  if (velocity > VELOCITY_THRESHOLD) return "dismissed";
  if (velocity < -VELOCITY_THRESHOLD) return "full";

  const snaps: SnapPosition[] = ["dismissed", "peek", "half", "full"];
  let closest: SnapPosition = "peek";
  let minDist = Infinity;

  for (const snap of snaps) {
    const snapY = getSnapY(snap, windowHeight, peekHeight, halfHeight, fullHeight);
    const dist = Math.abs(y - snapY);
    if (dist < minDist) {
      minDist = dist;
      closest = snap;
    }
  }

  return closest;
}

export function SnapBottomSheet({
  children,
  peekContent,
  onClose,
  initialSnap = "peek",
  peekHeight = 140,
  halfHeight = "50vh",
  fullHeight = "90vh",
}: SnapBottomSheetProps) {
  const [snap, setSnap] = useState<SnapPosition>(initialSnap);
  const [translateY, setTranslateY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);
  const velocityTracker = useRef<{ t: number; y: number }[]>([]);
  const isDraggingRef = useRef(false);
  const scrollLockedRef = useRef(false);

  // Fade hint text after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Close when dismissed
  useEffect(() => {
    if (snap !== "dismissed") return;
    const timer = setTimeout(onClose, 200);
    return () => clearTimeout(timer);
  }, [snap, onClose]);

  const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const currentSnapY = getSnapY(snap, windowHeight, peekHeight, halfHeight, fullHeight);

  const getVelocity = useCallback((): number => {
    const points = velocityTracker.current;
    if (points.length < 2) return 0;
    const last = points[points.length - 1]!;
    const prev = points[Math.max(0, points.length - 3)]!;
    const dt = (last.t - prev.t) / 1000;
    if (dt === 0) return 0;
    return (last.y - prev.y) / dt;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      // Check if touch is on drag handle or if content is scrolled to top
      const target = e.target as HTMLElement;
      const isHandleArea = target.closest("[data-drag-handle]") !== null;
      const contentEl = contentRef.current;

      if (!isHandleArea && snap !== "peek") {
        // Content area touch — check scroll position
        if (contentEl && contentEl.scrollTop > 0) {
          scrollLockedRef.current = false;
          return; // Let content scroll naturally
        }
        scrollLockedRef.current = true;
      } else {
        scrollLockedRef.current = true;
      }

      isDraggingRef.current = true;
      setIsDragging(true);
      startYRef.current = touch.clientY;
      startTranslateRef.current = translateY ?? currentSnapY;
      velocityTracker.current = [{ t: Date.now(), y: touch.clientY }];
    },
    [snap, translateY, currentSnapY]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current || !scrollLockedRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      e.preventDefault();
      const delta = touch.clientY - startYRef.current;
      const newY = Math.max(
        getSnapY("full", windowHeight, peekHeight, halfHeight, fullHeight),
        startTranslateRef.current + delta
      );
      setTranslateY(newY);

      velocityTracker.current.push({ t: Date.now(), y: touch.clientY });
      if (velocityTracker.current.length > 5) velocityTracker.current.shift();
    },
    [windowHeight, peekHeight, halfHeight, fullHeight]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const velocity = getVelocity();
    const currentY = translateY ?? currentSnapY;

    const nextSnap = findClosestSnap(
      currentY,
      velocity,
      windowHeight,
      peekHeight,
      halfHeight,
      fullHeight
    );

    setSnap(nextSnap);
    setTranslateY(null);
  }, [translateY, currentSnapY, getVelocity, windowHeight, peekHeight, halfHeight, fullHeight]);

  // Tap on peek → open to half
  const handlePeekTap = useCallback(() => {
    if (snap === "peek") setSnap("half");
  }, [snap]);

  const displayY = translateY ?? currentSnapY;
  const sheetHeight = windowHeight - displayY;

  return (
    <div className="fixed inset-0 z-30 sm:hidden" style={{ pointerEvents: "none" }}>
      {/* Backdrop — visible at half/full */}
      {(snap === "half" || snap === "full") && !isDragging && (
        <div
          className="absolute inset-0 bg-black/20 transition-opacity duration-200"
          style={{ pointerEvents: "auto" }}
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="bg-card absolute inset-x-0 rounded-t-2xl shadow-2xl"
        style={{
          pointerEvents: "auto",
          top: `${displayY}px`,
          height: `${sheetHeight}px`,
          transition: isDragging ? "none" : "top 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
          willChange: isDragging ? "top" : "auto",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div
          data-drag-handle
          className="flex cursor-grab flex-col items-center pt-3 pb-1 active:cursor-grabbing"
          style={{ minHeight: `${DRAG_HANDLE_HEIGHT}px` }}
        >
          <div className="bg-border h-1 w-10 rounded-full" />
        </div>

        {/* Peek content — always visible */}
        {peekContent && (
          <div onClick={handlePeekTap} className="px-4 pb-2">
            {peekContent}
            {/* Hint text */}
            <div
              className="text-muted-foreground mt-1 flex items-center justify-center gap-1 text-xs transition-opacity duration-500"
              style={{ opacity: hintVisible ? 0.7 : 0 }}
            >
              <ChevronUp className="h-3 w-3" />
              Swipe up for details
            </div>
          </div>
        )}

        {/* Scrollable content — visible at half/full */}
        {snap !== "peek" && (
          <div
            ref={contentRef}
            className="overflow-y-auto"
            style={{
              height: `calc(100% - ${peekHeight}px)`,
              overscrollBehavior: "contain",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
