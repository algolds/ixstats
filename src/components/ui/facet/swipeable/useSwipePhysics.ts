"use client";

/**
 * useSwipePhysics: spring physics for the swipeable row. A motion value tracks the row's X, a
 * spring follows it, and the action trays derive their opacity / scale / progress from the
 * spring. Pointer flow: down records the start, move (past the dead zone) captures the pointer
 * and tracks velocity, up picks the snap point. RTL flips the swipe direction.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMotionValue, useSpring, useTransform } from "motion/react";
import { clamp } from "~/lib/utils/math";
import {
  SPRING_PRESETS,
  DEFAULT_THRESHOLDS,
  VELOCITY_COMMIT,
  VELOCITY_REVEAL,
  DRAG_DEAD_ZONE,
  DRAG_ELASTICITY,
} from "./constants";
import type { SpringPreset, SwipeState, SwipeSide, SwipeThresholds } from "./types";

function getDocDir(): "ltr" | "rtl" {
  if (typeof document === "undefined") return "ltr";
  return (document.documentElement.dir as "ltr" | "rtl") || "ltr";
}

interface ThresholdsPx {
  reveal: number;
  emphasize: number;
  commit: number;
}

/** Rubber-band resistance past the commit threshold; the side without actions stays at 0. */
function resistDrag(
  targetX: number,
  { hasLeading, hasTrailing, commit }: ThresholdsPx & { hasLeading: boolean; hasTrailing: boolean },
  containerWidth: number
): number {
  let x: number;
  if (targetX < -commit && hasTrailing) {
    x = -(commit + (Math.abs(targetX) - commit) * DRAG_ELASTICITY);
  } else if (targetX > commit && hasLeading) {
    x = commit + (targetX - commit) * DRAG_ELASTICITY;
  } else {
    const maxTrailing = hasTrailing ? -(containerWidth * DRAG_ELASTICITY + commit) : 0;
    const maxLeading = hasLeading ? containerWidth * DRAG_ELASTICITY + commit : 0;
    x = clamp(targetX, maxTrailing, maxLeading);
  }
  if ((x > 0 && !hasLeading) || (x < 0 && !hasTrailing)) return 0;
  return x;
}

/** Visual state while dragging, by how far the row has travelled. */
function dragState(absX: number, px: ThresholdsPx): SwipeState {
  if (absX >= px.commit) return "committing";
  if (absX >= px.emphasize) return "emphasized";
  if (absX >= px.reveal) return "revealing";
  return "dragging";
}

/** Where a released drag settles: commit (fast flick or past the commit point), reveal, or closed. */
function releaseOutcome(
  currentX: number,
  velocity: number,
  px: ThresholdsPx,
  containerWidth: number
): { targetX: number; state: SwipeState } {
  const absX = Math.abs(currentX);
  const absVelocity = Math.abs(velocity);
  const sign = currentX < 0 ? -1 : 1;
  const commit = { targetX: sign * containerWidth, state: "committing" as const };

  const flickedWithDrag = velocity * sign > 0;
  if (absVelocity > VELOCITY_COMMIT && absX > px.reveal && flickedWithDrag) return commit;
  if (absX >= px.commit) return commit;

  if (absX >= px.reveal) {
    // A fast pull back toward closed beats the reveal snap
    const pulledBack = absVelocity > VELOCITY_REVEAL && velocity * sign < 0;
    return pulledBack
      ? { targetX: 0, state: "closed" }
      : { targetX: sign * px.reveal, state: "revealing" };
  }
  return { targetX: 0, state: "closed" };
}

/** Tray opacity, progress and emphasized-icon scale for one swipe direction (`sign` 1 = right, -1 = left). */
function useSideTransforms(springX: ReturnType<typeof useSpring>, px: ThresholdsPx, sign: 1 | -1) {
  return {
    progress: useTransform(springX, [0, sign * (px.commit || 1)], [0, 1]),
    trayOpacity: useTransform(springX, [0, sign * px.reveal * 0.5, sign * px.reveal], [0, 0.3, 1]),
    emphasizeScale: useTransform(
      springX,
      [0, sign * px.emphasize, sign * px.commit],
      [0.8, 1.0, 1.2]
    ),
  };
}

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

interface SwipePhysicsResult {
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

  const thresholdsPx = useMemo(
    () => ({
      reveal: containerWidth * t.reveal,
      emphasize: containerWidth * t.emphasize,
      commit: containerWidth * t.commit,
    }),
    [containerWidth, t.reveal, t.emphasize, t.commit]
  );

  // RTL support: flip the meaning of "left" and "right"
  const isRtl = useRef(getDocDir() === "rtl");
  useEffect(() => {
    isRtl.current = getDocDir() === "rtl";
  });

  const rawX = useMotionValue(0);
  const springX = useSpring(rawX, spring);
  const trailing = useSideTransforms(springX, thresholdsPx, -1);
  const leading = useSideTransforms(springX, thresholdsPx, 1);

  // Refs for drag tracking

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
  // oxlint-disable-next-line
  onStateChangeRef.current = onStateChange;

  // State transition helper

  const setState = useCallback((next: SwipeState) => {
    if (swipeState.current !== next) {
      swipeState.current = next;
      onStateChangeRef.current?.(next);
    }
  }, []);

  // Settle & Reset

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

  // Pointer Handlers

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.stopPropagation();
      // Capture only once a real drag starts (see handlePointerMove): capturing on press would
      // retarget the click to this element, so a plain click on an interactive child (a row's
      // button or link) would never reach it.
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
      const el = e.currentTarget as HTMLElement;
      if (isDragging.current && el.hasPointerCapture?.(e.pointerId) === false) return;

      e.stopPropagation();
      const deltaX = e.clientX - dragStartX.current;
      const rtlMultiplier = isRtl.current ? -1 : 1;
      const adjustedDelta = deltaX * rtlMultiplier;

      // Dead zone check
      if (!isDragging.current) {
        if (Math.abs(deltaX) < DRAG_DEAD_ZONE) return;
        isDragging.current = true;
        wasDrag.current = true;
        try {
          el.setPointerCapture?.(e.pointerId);
        } catch {
          // The pointer is no longer active; the drag continues on bubbled events.
        }
        setState("dragging");
      }

      // Determine which side is being swiped
      const targetX = dragStartSpringX.current + adjustedDelta;
      if (targetX < 0 && hasTrailing) {
        activeSide.current = "trailing";
      } else if (targetX > 0 && hasLeading) {
        activeSide.current = "leading";
      }

      const clampedX = resistDrag(
        targetX,
        { ...thresholdsPx, hasLeading, hasTrailing },
        containerWidth
      );
      rawX.set(clampedX);
      setState(dragState(Math.abs(clampedX), thresholdsPx));

      // Track velocity
      const dt = e.timeStamp - lastMoveTime.current;
      if (dt > 0) {
        velocity.current = (((e.clientX - lastMoveX.current) * rtlMultiplier) / dt) * 1000;
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
      if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }

      activePointerId.current = null;

      if (!isDragging.current) {
        // This was a tap, not a drag
        isDragging.current = false;
        return;
      }

      isDragging.current = false;
      const { targetX, state } = releaseOutcome(
        rawX.get(),
        velocity.current,
        thresholdsPx,
        containerWidth
      );
      settle(targetX);
      setState(state);
      if (state === "closed") activeSide.current = null;
    },
    [rawX, settle, setState, thresholdsPx.commit, thresholdsPx.reveal, containerWidth]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (activePointerId.current !== null) {
        if ((e.currentTarget as HTMLElement).hasPointerCapture?.(activePointerId.current)) {
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

  // Cleanup on unmount

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
    trailingProgress: trailing.progress,
    leadingProgress: leading.progress,
    trailingTrayOpacity: trailing.trayOpacity,
    leadingTrayOpacity: leading.trayOpacity,
    trailingEmphasizeScale: trailing.emphasizeScale,
    leadingEmphasizeScale: leading.emphasizeScale,
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
