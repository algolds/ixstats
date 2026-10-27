"use client";

/**
 * SnapBottomSheet — Physics-based bottom sheet with 3 snap positions (mobile only).
 *
 * Positions:
 * - Peek (~140px): Summary content visible over the map
 * - Half (~50vh): Scrollable content
 * - Full (~90vh): Full tabbed content
 *
 * Performance: the sheet has a fixed height and moves with a GPU `transform`. While dragging,
 * the transform is written straight to the DOM from a native (non-passive) touch listener, so a
 * drag re-renders nothing — the old version set React state on every `touchmove` and animated
 * `top`/`height`, re-rendering the whole panel and forcing layout each frame.
 *
 * Gesture physics:
 * - Velocity-based snap (>500px/s fast swipe)
 * - Inner scroll lock at peek; at half/full the content scrolls, and a downward drag from the
 *   top of the scroll area (or any drag on the handle) moves the sheet instead
 *
 * Keyboard: the handle is a button that steps peek → half → full → peek; Escape (handled by the
 * map's keyboard controls) closes the panel.
 */

import { useRef, useCallback, useState, useEffect, useLayoutEffect } from "react";
import { NavArrowUp as ChevronUp } from "iconoir-react";

type SnapPosition = "dismissed" | "peek" | "half" | "full";

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
const DRAG_HANDLE_HEIGHT = 44;
const SNAP_TRANSITION = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";

function parseHeight(h: string, windowHeight: number): number {
  if (h.endsWith("vh") || h.endsWith("dvh")) return (parseFloat(h) / 100) * windowHeight;
  return parseFloat(h);
}

/** Visible height of the sheet at a snap position. */
function visibleHeight(
  snap: SnapPosition,
  windowHeight: number,
  peekHeight: number,
  halfHeight: string,
  fullHeight: string
): number {
  if (snap === "dismissed") return 0;
  if (snap === "peek") return peekHeight;
  return parseHeight(snap === "half" ? halfHeight : fullHeight, windowHeight);
}

const NEXT_SNAP: Record<"peek" | "half" | "full", "peek" | "half" | "full"> = {
  peek: "half",
  half: "full",
  full: "peek",
};

/** Whether `target` sits in a vertically scrollable element (below `root`) that isn't at its top. */
function isInsideScrolledArea(target: HTMLElement, root: HTMLElement): boolean {
  let node: HTMLElement | null = target;
  while (node && node !== root) {
    if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight) return true;
    node = node.parentElement;
  }
  return false;
}

function getWindowHeight() {
  return typeof window !== "undefined" ? window.innerHeight : 800;
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
  const [windowHeight, setWindowHeight] = useState(getWindowHeight);
  const [hintVisible, setHintVisible] = useState(true);

  const sheetRef = useRef<HTMLDivElement>(null);
  const hasEnteredRef = useRef(false);

  const sheetHeight = visibleHeight("full", windowHeight, peekHeight, halfHeight, fullHeight);
  const offsetFor = useCallback(
    (s: SnapPosition) =>
      sheetHeight - visibleHeight(s, windowHeight, peekHeight, halfHeight, fullHeight),
    [sheetHeight, windowHeight, peekHeight, halfHeight, fullHeight]
  );

  // Latest values for the native touch listeners (bound once).
  const stateRef = useRef({ snap, offsetFor });
  const sheetHeightRef = useRef(sheetHeight);
  useEffect(() => {
    stateRef.current = { snap, offsetFor };
    sheetHeightRef.current = sheetHeight;
  }, [snap, offsetFor, sheetHeight]);

  // Track viewport height (rotation, mobile browser chrome showing/hiding).
  useEffect(() => {
    const onResize = () => setWindowHeight(getWindowHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fade hint text after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Close when dismissed (after the slide-out)
  useEffect(() => {
    if (snap !== "dismissed") return;
    const timer = setTimeout(onClose, 200);
    return () => clearTimeout(timer);
  }, [snap, onClose]);

  // Apply the settled snap position. On first mount, slide in from off-screen.
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const target = `translate3d(0, ${offsetFor(snap)}px, 0)`;
    if (!hasEnteredRef.current) {
      hasEnteredRef.current = true;
      el.style.transition = "none";
      el.style.transform = `translate3d(0, ${sheetHeight}px, 0)`;
      const frame = requestAnimationFrame(() => {
        el.style.transition = SNAP_TRANSITION;
        el.style.transform = target;
      });
      return () => cancelAnimationFrame(frame);
    }
    el.style.transition = SNAP_TRANSITION;
    el.style.transform = target;
    return undefined;
  }, [snap, offsetFor, sheetHeight]);

  // Native touch handling: non-passive so the page doesn't scroll while the sheet drags.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    let dragging = false;
    let decided = false; // whether this gesture has committed to "drag sheet" vs "scroll"
    let fromHandle = false;
    let startY = 0;
    let startOffset = 0;
    let currentOffset = 0;
    let samples: { t: number; y: number }[] = [];

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || e.touches.length > 1) return;
      const { snap: s, offsetFor: off } = stateRef.current;
      const target = e.target as HTMLElement;
      fromHandle = target.closest("[data-drag-handle]") !== null || s === "peek";
      // Touch inside a scrolled-down scroll area (the sheet's or a nested one): let it scroll.
      if (!fromHandle && isInsideScrolledArea(target, el)) {
        dragging = false;
        return;
      }

      dragging = true;
      decided = fromHandle;
      startY = touch.clientY;
      startOffset = off(s);
      currentOffset = startOffset;
      samples = [{ t: e.timeStamp, y: touch.clientY }];
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY;

      if (!decided) {
        if (Math.abs(delta) < 4) return;
        // At full height an upward swipe on the content is a scroll, not a drag.
        if (stateRef.current.snap === "full" && delta < 0) {
          dragging = false;
          return;
        }
        decided = true;
      }

      e.preventDefault();
      currentOffset = Math.min(sheetHeightRef.current, Math.max(0, startOffset + delta));
      el.style.transition = "none";
      el.style.transform = `translate3d(0, ${currentOffset}px, 0)`;
      samples.push({ t: e.timeStamp, y: touch.clientY });
      if (samples.length > 5) samples.shift();
    };

    const onTouchEnd = () => {
      if (!dragging) return;
      dragging = false;
      if (!decided) return; // a tap — let click handlers run

      const last = samples[samples.length - 1];
      const prev = samples[Math.max(0, samples.length - 3)];
      const dt = last && prev ? (last.t - prev.t) / 1000 : 0;
      const velocity = last && prev && dt > 0 ? (last.y - prev.y) / dt : 0;

      const { snap: current, offsetFor: off } = stateRef.current;
      let next: SnapPosition;
      if (velocity > VELOCITY_THRESHOLD) next = current === "full" ? "half" : "dismissed";
      else if (velocity < -VELOCITY_THRESHOLD) next = "full";
      else {
        next = "peek";
        let min = Infinity;
        for (const s of ["dismissed", "peek", "half", "full"] as SnapPosition[]) {
          const d = Math.abs(currentOffset - off(s));
          if (d < min) {
            min = d;
            next = s;
          }
        }
      }

      // Settle imperatively too: when the snap doesn't change, no effect re-runs.
      el.style.transition = SNAP_TRANSITION;
      el.style.transform = `translate3d(0, ${off(next)}px, 0)`;
      setSnap(next);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const handlePeekTap = useCallback(() => setSnap((s) => (s === "peek" ? "half" : s)), []);
  const handleHandleClick = useCallback(
    () => setSnap((s) => (s === "dismissed" ? s : NEXT_SNAP[s])),
    []
  );

  const expanded = snap === "half" || snap === "full";
  // Part of the fixed-height sheet sits below the fold at peek/half; pad the scroll area by
  // that amount so its last items can still be scrolled into view.
  const hiddenBelow = Math.max(0, offsetFor(snap));

  return (
    <div className="fixed inset-0 z-30 sm:hidden" style={{ pointerEvents: "none" }}>
      {/* Backdrop — visible at half/full */}
      {expanded && (
        <div
          className="absolute inset-0 bg-black/30"
          style={{ pointerEvents: "auto" }}
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        ref={sheetRef}
        role="region"
        aria-label="Details"
        className="bg-surface ring-separator rounded-t-card shadow-floating absolute inset-x-0 bottom-0 flex flex-col ring-1"
        style={{
          pointerEvents: "auto",
          height: `${sheetHeight}px`,
          willChange: "transform",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Drag handle (also a keyboard/screen-reader control) */}
        <button
          type="button"
          data-drag-handle
          onClick={handleHandleClick}
          aria-expanded={expanded}
          aria-label={snap === "full" ? "Collapse details" : "Show more details"}
          className="focus-visible:ring-tint rounded-t-card flex w-full shrink-0 cursor-grab touch-none flex-col items-center justify-center focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset active:cursor-grabbing"
          style={{ minHeight: `${DRAG_HANDLE_HEIGHT}px` }}
        >
          <span className="bg-fill-2 h-1 w-10 rounded-full" />
        </button>

        {/* Peek content — always visible */}
        {peekContent && (
          <div onClick={handlePeekTap} className="shrink-0 px-4 pb-2">
            {peekContent}
            <div
              className="text-label-secondary text-footnote mt-1 flex items-center justify-center gap-1 transition-opacity duration-200"
              style={{ opacity: hintVisible && snap === "peek" ? 0.7 : 0 }}
              aria-hidden
            >
              <ChevronUp className="h-3 w-3" />
              Swipe up for details
            </div>
          </div>
        )}

        {/* Scrollable content — rendered at half/full */}
        {snap !== "peek" && (
          <div
            className="min-h-0 flex-1 overflow-y-auto"
            style={{ overscrollBehavior: "contain", paddingBottom: `${hiddenBelow}px` }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
