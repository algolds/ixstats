"use client";

/**
 * useSwipePhysics — Reusable spring physics hook for glass interaction primitives
 *
 * Provides:
 * - MotionValue-based X position tracking
 * - Spring-animated settlement to snap points
 * - Velocity tracking for fast-flick gesture detection
 * - Derived transforms (opacity, scale, progress) for action trays
 * - RTL-aware direction flipping
 *
 * Based on the pointer-capture pattern from apple-switch.tsx:
 * - onPointerDown  → capture pointer, record start position
 * - onPointerMove  → update motion value, track velocity
 * - onPointerUp    → evaluate snap point, spring to target
 */

import { useCallback, useEffect, useRef } from "react";
import { useMotionValue, useSpring, useTransform } from "motion/react";
import {
  SPRING_PRESETS,
  DEFAULT_THRESHOLDS,
  VELOCITY_COMMIT,
  VELOCITY_REVEAL,
  DRAG_DEAD_ZONE,
  DRAG_ELASTICITY,
} from "./constants";
import type { SpringPreset, SwipeState, SwipeSide, SwipeThresholds } from "./types";

// ── Helpers ─────────────────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function getDocDir(): "ltr" | "rtl" {
  if (typeof document === "undefined") return "ltr";
  return (document.documentElement.dir as "ltr" | "rtl") || "ltr";
}

// ── Hook ────────────────────────────────────────────────────────────────

interface UseSwipePhysicsOptions {
  /** Container width in px (must be kept in sync via ResizeObserver) */
  containerWidth: number;
  /** Spring preset name */
  springPreset?: SpringPreset;
  /** Snap thresholds (merged with defaults) */
  thresholds?: SwipeThresholds;
  /** Whether leading (right-swipe) actions exist */
  hasLeading: boolean;
  /** Whether trailing (left-swipe) actions exist */
  hasTrailing: boolean;
  /** Disable all interactions */
  disabled?: boolean;
  /** Callback on state change */
  onStateChange?: (state: SwipeState) => void;
}

export interface SwipePhysicsResult {
  /** The current X translation (motion value) */
  x: ReturnType<typeof useMotionValue<number>>;
  /** Spring-animated X position */
  springX: ReturnType<typeof useSpring>;
  /** Normalized swipe progress for the trailing side (0 → 1, left swipe) */
  trailingProgress: ReturnType<typeof useTransform<number, number>>;
  /** Normalized swipe progress for the leading side (0 → 1, right swipe) */
  leadingProgress: ReturnType<typeof useTransform<number, number>>;
  /** Opacity for the trailing action tray */
  trailingTrayOpacity: ReturnType<typeof useTransform<number, number>>;
  /** Opacity for the leading action tray */
  leadingTrayOpacity: ReturnType<typeof useTransform<number, number>>;
  /** Scale for the emphasized primary action (trailing) */
  trailingEmphasizeScale: ReturnType<typeof useTransform<number, number>>;
  /** Scale for the emphasized primary action (leading) */
  leadingEmphasizeScale: ReturnType<typeof useTransform<number, number>>;
  /** Current swipe state */
  swipeState: React.RefObject<SwipeState>;
  /** Current active side */
  activeSide: React.RefObject<SwipeSide>;
  /** Whether a drag is in progress */
  isDragging: React.RefObject<boolean>;
  /** Pointer event handlers to attach to the draggable element */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Spring-settle to a specific X position */
  settle: (targetX: number) => void;
  /** Reset to closed position */
  reset: () => void;
  /** Resolved thresholds in px */
  thresholdsPx: { reveal: number; emphasize: number; commit: number };
  /** Whether the swipe was a drag (true) or a tap (false) after pointerUp */
  wasDrag: React.RefObject<boolean>;
}

export function useSwipePhysics({
  containerWidth,
  springPreset = "tight",
  thresholds: customThresholds,
  hasLeading,
  hasTrailing,
  disabled = false,
  onStateChange,
}: UseSwipePhysicsOptions): SwipePhysicsResult {
  const spring = SPRING_PRESETS[springPreset];

  // Merge custom thresholds with defaults
  const t = {
    reveal: customThresholds?.reveal ?? DEFAULT_THRESHOLDS.reveal,
    emphasize: customThresholds?.emphasize ?? DEFAULT_THRESHOLDS.emphasize,
    commit: customThresholds?.commit ?? DEFAULT_THRESHOLDS.commit,
  };

  // Convert to pixels
  const thresholdsPx = {
    reveal: containerWidth * t.reveal,
    emphasize: containerWidth * t.emphasize,
    commit: containerWidth * t.commit,
  };

  // RTL support: flip the meaning of "left" and "right"
  const isRtl = useRef(getDocDir() === "rtl");
  useEffect(() => {
    isRtl.current = getDocDir() === "rtl";
  });

  // ── Motion values ─────────────────────────────────────────────────────

  const rawX = useMotionValue(0);
  const springX = useSpring(rawX, spring);

  // Trailing progress: how far we've swiped left (0 → 1)
  const trailingProgress = useTransform(
    springX,
    [0, -thresholdsPx.commit || -1],
    [0, 1]
  );

  // Leading progress: how far we've swiped right (0 → 1)
  const leadingProgress = useTransform(
    springX,
    [0, thresholdsPx.commit || 1],
    [0, 1]
  );

  // Action tray opacities (fade in during reveal phase)
  const trailingTrayOpacity = useTransform(
    springX,
    [0, -(thresholdsPx.reveal * 0.5), -thresholdsPx.reveal],
    [0, 0.3, 1]
  );

  const leadingTrayOpacity = useTransform(
    springX,
    [0, thresholdsPx.reveal * 0.5, thresholdsPx.reveal],
    [0, 0.3, 1]
  );

  // Emphasized action icon scale (grows past the emphasize threshold)
  const trailingEmphasizeScale = useTransform(
    springX,
    [0, -thresholdsPx.emphasize, -thresholdsPx.commit],
    [0.8, 1.0, 1.2]
  );

  const leadingEmphasizeScale = useTransform(
    springX,
    [0, thresholdsPx.emphasize, thresholdsPx.commit],
    [0.8, 1.0, 1.2]
  );

  // ── Refs for drag tracking ────────────────────────────────────────────

  const swipeState = useRef<SwipeState>("closed");
  const activeSide = useRef<SwipeSide>(null);
  const isDragging = useRef(false);
  const wasDrag = useRef(false);
  const dragStartX = useRef(0);
  const dragStartSpringX = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const lastMoveTime = useRef(0);
  const lastMoveX = useRef(0);
  const velocity = useRef(0);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // ── State transition helper ───────────────────────────────────────────

  const setState = useCallback((next: SwipeState) => {
    if (swipeState.current !== next) {
      swipeState.current = next;
      onStateChangeRef.current?.(next);
    }
  }, []);

  // ── Settle & Reset ────────────────────────────────────────────────────

  const settle = useCallback(
    (targetX: number) => {
      rawX.set(targetX);
    },
    [rawX]
  );

  const reset = useCallback(() => {
    rawX.set(0);
    setState("closed");
    activeSide.current = null;
  }, [rawX, setState]);

  // ── Pointer Handlers ──────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      activePointerId.current = e.pointerId;
      isDragging.current = false;
      wasDrag.current = false;
      dragStartX.current = e.clientX;
      dragStartSpringX.current = springX.get();
      rawX.set(dragStartSpringX.current);
      lastMoveTime.current = e.timeStamp;
      lastMoveX.current = e.clientX;
      velocity.current = 0;
    },
    [disabled, springX, rawX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (activePointerId.current === null) return;
      if (e.pointerId !== activePointerId.current) return;
      if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;

      e.stopPropagation();
      const deltaX = e.clientX - dragStartX.current;
      const rtlMultiplier = isRtl.current ? -1 : 1;
      const adjustedDelta = deltaX * rtlMultiplier;

      // Dead zone check
      if (!isDragging.current) {
        if (Math.abs(deltaX) < DRAG_DEAD_ZONE) return;
        isDragging.current = true;
        wasDrag.current = true;
        setState("dragging");
      }

      // Determine which side is being swiped
      const targetX = dragStartSpringX.current + adjustedDelta;
      if (targetX < 0 && hasTrailing) {
        activeSide.current = "trailing";
      } else if (targetX > 0 && hasLeading) {
        activeSide.current = "leading";
      }

      // Clamp with elasticity past commit threshold
      let clampedX: number;
      const maxTrailing = hasTrailing ? -(containerWidth * DRAG_ELASTICITY + thresholdsPx.commit) : 0;
      const maxLeading = hasLeading ? containerWidth * DRAG_ELASTICITY + thresholdsPx.commit : 0;

      // Apply rubber-band resistance past the commit threshold
      if (targetX < -thresholdsPx.commit && hasTrailing) {
        const overshoot = Math.abs(targetX) - thresholdsPx.commit;
        clampedX = -(thresholdsPx.commit + overshoot * DRAG_ELASTICITY);
      } else if (targetX > thresholdsPx.commit && hasLeading) {
        const overshoot = targetX - thresholdsPx.commit;
        clampedX = thresholdsPx.commit + overshoot * DRAG_ELASTICITY;
      } else {
        clampedX = clamp(targetX, maxTrailing, maxLeading);
      }

      // Don't allow dragging into a side that has no actions
      if (clampedX > 0 && !hasLeading) clampedX = 0;
      if (clampedX < 0 && !hasTrailing) clampedX = 0;

      rawX.set(clampedX);

      // Determine visual state based on position
      const absX = Math.abs(clampedX);
      if (absX >= thresholdsPx.commit) {
        setState("committing");
      } else if (absX >= thresholdsPx.emphasize) {
        setState("emphasized");
      } else if (absX >= thresholdsPx.reveal) {
        setState("revealing");
      } else {
        setState("dragging");
      }

      // Track velocity
      const dt = e.timeStamp - lastMoveTime.current;
      if (dt > 0) {
        velocity.current = ((e.clientX - lastMoveX.current) * rtlMultiplier) / dt * 1000;
      }
      lastMoveTime.current = e.timeStamp;
      lastMoveX.current = e.clientX;
    },
    [
      disabled,
      containerWidth,
      hasLeading,
      hasTrailing,
      rawX,
      setState,
      thresholdsPx.commit,
      thresholdsPx.emphasize,
      thresholdsPx.reveal,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activePointerId.current === null) return;
      if (e.pointerId !== activePointerId.current) return;

      e.stopPropagation();
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }

      activePointerId.current = null;

      if (!isDragging.current) {
        // This was a tap, not a drag
        isDragging.current = false;
        return;
      }

      isDragging.current = false;
      const currentX = rawX.get();
      const absX = Math.abs(currentX);
      const absVelocity = Math.abs(velocity.current);
      const direction = currentX < 0 ? "trailing" : "leading";

      // Velocity-based fast-flick commit
      if (absVelocity > VELOCITY_COMMIT && absX > thresholdsPx.reveal) {
        // Check if the velocity direction matches the drag direction
        const velocityMatchesDirection =
          (direction === "trailing" && velocity.current < 0) ||
          (direction === "leading" && velocity.current > 0);

        if (velocityMatchesDirection) {
          const targetX = direction === "trailing" ? -containerWidth : containerWidth;
          settle(targetX);
          setState("committing");
          return; // Let the consumer handle commit (the state change triggers it)
        }
      }

      // Position-based snap
      if (absX >= thresholdsPx.commit) {
        // Past commit threshold — commit
        const targetX = direction === "trailing" ? -containerWidth : containerWidth;
        settle(targetX);
        setState("committing");
        return;
      } else if (absX >= thresholdsPx.reveal) {
        // Past reveal threshold — snap to reveal position
        const revealX = direction === "trailing" ? -thresholdsPx.reveal : thresholdsPx.reveal;

        // If velocity is pulling back toward closed, snap closed instead
        if (absVelocity > VELOCITY_REVEAL) {
          const velocityTowardsClosed =
            (direction === "trailing" && velocity.current > 0) ||
            (direction === "leading" && velocity.current < 0);

          if (velocityTowardsClosed) {
            settle(0);
            setState("closed");
            activeSide.current = null;
            return;
          }
        }

        settle(revealX);
        setState("revealing");
      } else {
        // Below reveal threshold — snap back to closed
        settle(0);
        setState("closed");
        activeSide.current = null;
      }
    },
    [rawX, settle, setState, thresholdsPx.commit, thresholdsPx.reveal, containerWidth]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (activePointerId.current !== null) {
        if ((e.currentTarget as HTMLElement).hasPointerCapture(activePointerId.current)) {
          (e.currentTarget as HTMLElement).releasePointerCapture(activePointerId.current);
        }
      }
      activePointerId.current = null;
      isDragging.current = false;
      settle(0);
      setState("closed");
      activeSide.current = null;
    },
    [settle, setState]
  );

  // ── Cleanup on unmount ────────────────────────────────────────────────

  useEffect(() => {
    const cleanup = () => {
      if (activePointerId.current !== null) {
        activePointerId.current = null;
        isDragging.current = false;
        rawX.set(0);
      }
    };

    window.addEventListener("blur", cleanup);
    return () => window.removeEventListener("blur", cleanup);
  }, [rawX]);

  return {
    x: rawX,
    springX,
    trailingProgress,
    leadingProgress,
    trailingTrayOpacity,
    leadingTrayOpacity,
    trailingEmphasizeScale,
    leadingEmphasizeScale,
    swipeState,
    activeSide,
    isDragging,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
    settle,
    reset,
    thresholdsPx,
    wasDrag,
  };
}
