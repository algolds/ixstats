"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import { useMotionValue, useSpring } from "motion/react";

export interface SliderBounds {
  left: number;
  width: number;
}

export interface UseSliderPhysicsOptions {
  bounds: Record<string, SliderBounds>;
  activeId: string;
  onChange: (id: string) => void;
  padding: number;
  containerWidth: number;
  indicatorSpringConfig?: { stiffness: number; damping: number; mass?: number };
  grabSpringConfig?: { stiffness: number; damping: number };
  dragElasticity?: number;
  dragDeadZone?: number;
}

const defaultIndicatorSpring = {
  stiffness: 480,
  damping: 36,
  mass: 0.65,
};

const defaultGrabSpring = {
  stiffness: 400,
  damping: 22,
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export function useSliderPhysics({
  bounds,
  activeId,
  onChange,
  padding,
  containerWidth,
  indicatorSpringConfig = defaultIndicatorSpring,
  grabSpringConfig = defaultGrabSpring,
  dragElasticity = 0.32,
  dragDeadZone = 3,
}: UseSliderPhysicsOptions) {
  const activeBounds = bounds[activeId];

  // ─── Motion Values & Springs ───────────────────────────────────────────────

  const [springConfig, setSpringConfig] = React.useState(indicatorSpringConfig);

  const rawX = useMotionValue(activeBounds ? activeBounds.left : 0);
  const rawWidth = useMotionValue(activeBounds ? activeBounds.width : 0);
  const grabProgress = useMotionValue(0);

  const springX = useSpring(rawX, springConfig);
  const springWidth = useSpring(rawWidth, springConfig);
  const springGrab = useSpring(grabProgress, grabSpringConfig);

  // Ref tracking drag coordinates and state
  const dragStartX = useRef(0);
  const dragStartThumbX = useRef(0);
  const dragStartThumbWidth = useRef(0);
  const isDragging = useRef(false);
  const suppressNextClick = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const lastMoveTime = useRef(0);
  const lastMoveX = useRef(0);

  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearClickTimeout = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  };

  // Keep springConfig in sync with parent prop if it changes (value comparison to avoid false triggers)
  const lastIndicatorConfig = useRef(indicatorSpringConfig);
  useEffect(() => {
    if (
      indicatorSpringConfig.stiffness !== lastIndicatorConfig.current.stiffness ||
      indicatorSpringConfig.damping !== lastIndicatorConfig.current.damping ||
      indicatorSpringConfig.mass !== lastIndicatorConfig.current.mass
    ) {
      setSpringConfig(indicatorSpringConfig);
      lastIndicatorConfig.current = indicatorSpringConfig;
    }
  }, [indicatorSpringConfig]);

  // Keep target X & Width in sync with active changes when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      if (activeBounds) {
        rawX.set(activeBounds.left);
        rawWidth.set(activeBounds.width);
      } else {
        rawWidth.set(0);
      }
    }
  }, [activeId, bounds, activeBounds, rawX, rawWidth]);

  // ─── Gesture Handlers ──────────────────────────────────────────────────────

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!activeBounds) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;

    // Reset spring config to default immediately on pointer down for fluid drag/flick
    clearClickTimeout();
    setSpringConfig(indicatorSpringConfig);

    grabProgress.set(1);
    dragStartX.current = event.clientX;
    dragStartThumbX.current = activeBounds.left;
    dragStartThumbWidth.current = activeBounds.width;

    isDragging.current = false;
    lastMoveTime.current = event.timeStamp;
    lastMoveX.current = event.clientX;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerId.current === null) return;
    if (event.pointerId !== activePointerId.current) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    event.stopPropagation();
    const deltaX = event.clientX - dragStartX.current;

    if (!isDragging.current && Math.abs(deltaX) > dragDeadZone) {
      isDragging.current = true;
    }

    if (!isDragging.current) return;
    event.preventDefault();

    // AppleSwitch-style indicator stretching
    let x_target: number;
    let width_target: number;

    if (deltaX > 0) {
      // Dragging right: left edge lags, right edge pushes forward
      x_target = dragStartThumbX.current + deltaX * 0.15;
      width_target = dragStartThumbWidth.current + deltaX * 0.5;
    } else {
      // Dragging left: left edge stretches out, right edge lags
      x_target = dragStartThumbX.current + deltaX * 0.65;
      width_target = dragStartThumbWidth.current - deltaX * 0.5;
    }

    // Limit maximum stretch
    const maxStretch = dragStartThumbWidth.current * 1.55;
    const minStretch = dragStartThumbWidth.current * 0.82;
    width_target = clamp(width_target, minStretch, maxStretch);

    // Apply elastic rubber banding past container outer limits
    const maxBoundX = containerWidth - width_target - padding;
    const minBoundX = padding;

    if (x_target < minBoundX) {
      const overshoot = minBoundX - x_target;
      x_target = minBoundX - overshoot * dragElasticity;
    } else if (x_target > maxBoundX) {
      const overshoot = x_target - maxBoundX;
      x_target = maxBoundX + overshoot * dragElasticity;
    }

    rawX.set(x_target);
    rawWidth.set(width_target);

    // Track movement for velocity calculation
    lastMoveTime.current = event.timeStamp;
    lastMoveX.current = event.clientX;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerId.current === null || event.pointerId !== activePointerId.current) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activePointerId.current = null;
    grabProgress.set(0);

    if (!isDragging.current) return;

    isDragging.current = false;
    suppressNextClick.current = true;

    // Settle based on closest target position or quick flick velocity
    const finalX = rawX.get();
    const finalWidth = rawWidth.get();
    const currentCenter = finalX + finalWidth / 2;

    const deltaX = event.clientX - dragStartX.current;
    const deltaTime = event.timeStamp - lastMoveTime.current;
    let velocity = 0;
    if (deltaTime > 0) {
      velocity = (event.clientX - lastMoveX.current) / deltaTime; // px/ms
    }

    let targetId = activeId;
    const ids = Object.keys(bounds);
    const activeIndex = ids.indexOf(activeId);

    // If velocity is quick, flick to neighbor
    if (Math.abs(velocity) > 0.4 && Math.abs(deltaX) > 15) {
      if (velocity > 0 && activeIndex < ids.length - 1) {
        targetId = ids[activeIndex + 1];
      } else if (velocity < 0 && activeIndex > 0) {
        targetId = ids[activeIndex - 1];
      }
    } else {
      // Find closest item by distance to center
      let minDistance = Infinity;
      Object.entries(bounds).forEach(([id, b]) => {
        const itemCenter = b.left + b.width / 2;
        const dist = Math.abs(currentCenter - itemCenter);
        if (dist < minDistance) {
          minDistance = dist;
          targetId = id;
        }
      });
    }

    if (targetId !== activeId) {
      onChange(targetId);
    } else {
      // Snap back to original target
      rawX.set(activeBounds.left);
      rawWidth.set(activeBounds.width);
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (activePointerId.current !== null) {
      if (event.currentTarget.hasPointerCapture(activePointerId.current)) {
        event.currentTarget.releasePointerCapture(activePointerId.current);
      }
    }
    activePointerId.current = null;
    isDragging.current = false;
    grabProgress.set(0);

    clearClickTimeout();
    setSpringConfig(indicatorSpringConfig);

    if (activeBounds) {
      rawX.set(activeBounds.left);
      rawWidth.set(activeBounds.width);
    }
  };

  const handleTabClick = (id: string, event: React.MouseEvent) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      event.preventDefault();
      return;
    }

    clearClickTimeout();
    // Fast snap settings: stiffness: 3000, damping: 120 (settles in ~60ms)
    setSpringConfig({ stiffness: 3000, damping: 120, mass: 1 });
    onChange(id);

    // After animation settles, restore default spring configuration
    clickTimeoutRef.current = setTimeout(() => {
      setSpringConfig(indicatorSpringConfig);
    }, 150);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activePointerId.current = null;
      isDragging.current = false;
      clearClickTimeout();
    };
  }, []);

  return {
    springX,
    springWidth,
    springGrab,
    isDragging,
    suppressNextClick,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
    handleTabClick,
  };
}
