"use client";

import {
  motion,
  useMotionValue,
  useReducedMotionConfig,
  useSpring,
  useTransform,
} from "motion/react";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { cn } from "~/lib/utils/cn";
import { clamp } from "~/lib/utils/math";
import { DURATION_FAST, springSnappy } from "~/lib/design/motion";

/**
 * Switch (spec §7.2): `role="switch"` + `aria-checked`. Off track `fill-2`, on track the tint
 * (`tone` picks another on colour); the white thumb follows `spring-snappy`, can be dragged, and
 * widens while held. Under Reduce Motion the thumb moves in a 150ms tween. 44px hit area on touch.
 */

const switchSizes = {
  sm: {
    trackX: 46,
    trackY: 24,
    thumbX: 22,
    thumbY: 18,
    padding: 3,
  },
  md: {
    trackX: 62,
    trackY: 30,
    thumbX: 32,
    thumbY: 24,
    padding: 4,
  },
  lg: {
    trackX: 74,
    trackY: 36,
    thumbX: 34,
    thumbY: 28,
    padding: 5,
  },
} as const;

/** On-track colour per tone. `neutral` and `accent` follow the app tint (§2.2). */
const switchTones = {
  neutral: "bg-tint",
  accent: "bg-tint",
  success: "bg-success",
  discord: "bg-discord",
} as const;

const thumbSpring = { stiffness: springSnappy.stiffness, damping: springSnappy.damping };
const reducedThumbSpring = { visualDuration: DURATION_FAST, bounce: 0 };

interface AppleSwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role"
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** @default "md" */
  size?: keyof typeof switchSizes;
  /** @default "neutral" */
  tone?: keyof typeof switchTones;
  /** @default "right" */
  labelSide?: "left" | "right";
}

const AppleSwitch = forwardRef<HTMLButtonElement, AppleSwitchProps>(
  (
    {
      checked,
      onCheckedChange,
      label,
      description,
      size = "md",
      tone = "neutral",
      labelSide = "right",
      className,
      style,
      disabled,
      defaultChecked,
      id,
      type = "button",
      onClick,
      onPointerCancel,
      onPointerDown,
      onPointerLeave,
      onPointerMove,
      onPointerUp,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const switchId = id ?? generatedId;
    const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
    const currentChecked = checked ?? uncontrolledChecked;
    const metrics = switchSizes[size];
    const onTrack = switchTones[tone];
    // Follows MotionConfig (FacetMotionConfig: OS + in-app Reduce Motion).
    const reduceMotion = useReducedMotionConfig();
    const thumbTravel = metrics.trackX - metrics.thumbX - metrics.padding * 2;
    const targetX = useMotionValue(currentChecked ? thumbTravel : 0);
    const thumbX = useSpring(targetX, reduceMotion ? reducedThumbSpring : thumbSpring);
    const grabTarget = useMotionValue(0);
    const grabProgress = useSpring(grabTarget, reduceMotion ? reducedThumbSpring : thumbSpring);
    // While held, the thumb stretches (never taller than the track).
    const thumbWidth = useTransform(
      grabProgress,
      [0, 1],
      [metrics.thumbX, metrics.thumbX + metrics.padding * 2]
    );
    const thumbHeight = metrics.thumbY;
    const thumbOffsetX = useTransform(() => thumbX.get() - (thumbWidth.get() - metrics.thumbX) / 2);
    const dragStartX = useRef(0);
    const dragStartThumbX = useRef(0);
    const isDragging = useRef(false);
    const activePointerId = useRef<number | null>(null);
    const suppressNextClick = useRef(false);
    const activeProgress = useTransform(thumbX, [0, thumbTravel], [0, 1]);
    const fillOpacity = useTransform(activeProgress, [0, 1], [0, 1]);

    useEffect(() => {
      if (activePointerId.current !== null) return;
      targetX.set(currentChecked ? thumbTravel : 0);
    }, [currentChecked, thumbTravel, targetX]);

    const setChecked = (next: boolean) => {
      if (next === currentChecked) {
        targetX.set(next ? thumbTravel : 0);
        return;
      }

      if (checked === undefined) {
        setUncontrolledChecked(next);
      }

      targetX.set(next ? thumbTravel : 0);
      onCheckedChange?.(next);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented || disabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointerId.current = event.pointerId;
      grabTarget.set(1);
      dragStartX.current = event.clientX;
      dragStartThumbX.current = thumbX.get();
      targetX.set(dragStartThumbX.current);
      isDragging.current = false;
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerMove?.(event);
      if (event.defaultPrevented || disabled) return;
      if (activePointerId.current !== null && event.pointerId !== activePointerId.current) {
        return;
      }
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

      const deltaX = event.clientX - dragStartX.current;

      if (Math.abs(deltaX) > 3) {
        isDragging.current = true;
      }

      if (!isDragging.current) return;
      event.preventDefault();

      const nextX = dragStartThumbX.current + deltaX;
      targetX.set(clamp(nextX, 0, thumbTravel));
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerUp?.(event);
      if (activePointerId.current !== null && event.pointerId !== activePointerId.current) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      activePointerId.current = null;
      grabTarget.set(0);

      if (!isDragging.current) return;

      isDragging.current = false;
      suppressNextClick.current = true;
      setChecked(targetX.get() >= thumbTravel / 2);
    };

    const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(event);
      activePointerId.current = null;
      isDragging.current = false;
      grabTarget.set(0);
      targetX.set(currentChecked ? thumbTravel : 0);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || disabled) return;

      if (suppressNextClick.current) {
        suppressNextClick.current = false;
        event.preventDefault();
        return;
      }

      setChecked(!currentChecked);
    };

    useEffect(() => {
      const stopFromWindow = () => {
        if (!isDragging.current && activePointerId.current === null) return;
        const wasDragging = isDragging.current;
        isDragging.current = false;
        activePointerId.current = null;
        grabTarget.set(0);
        if (!wasDragging) return;
        suppressNextClick.current = true;
        setChecked(targetX.get() >= thumbTravel / 2);
      };

      window.addEventListener("pointerup", stopFromWindow);
      window.addEventListener("pointercancel", stopFromWindow);
      window.addEventListener("blur", stopFromWindow);

      return () => {
        window.removeEventListener("pointerup", stopFromWindow);
        window.removeEventListener("pointercancel", stopFromWindow);
        window.removeEventListener("blur", stopFromWindow);
      };
    });

    const switchEl = (
      <button
        id={switchId}
        ref={ref}
        type={type}
        role="switch"
        aria-checked={currentChecked}
        data-slot="switch"
        data-state={currentChecked ? "checked" : "unchecked"}
        disabled={disabled}
        onClick={handleClick}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
        }}
        aria-label={typeof label === "string" ? label : props["aria-label"]}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full active:cursor-grabbing",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2",
          className
        )}
        style={{
          width: metrics.trackX,
          height: metrics.trackY,
          touchAction: "pan-y",
          ...style,
        }}
        {...props}
      >
        <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full bg-fill-2">
          <motion.span
            className={cn("absolute inset-0 rounded-full", onTrack)}
            style={{ opacity: fillOpacity }}
          />
        </span>

        <motion.span
          aria-hidden
          className="pointer-events-none relative block rounded-full bg-white"
          style={{
            width: thumbWidth,
            height: thumbHeight,
            x: thumbOffsetX,
            marginLeft: metrics.padding,
            boxShadow: "0 2px 6px rgb(0 0 0 / 0.2), 0 1px 1px rgb(0 0 0 / 0.1)",
          }}
        />
      </button>
    );

    if (!label) return switchEl;

    return (
      <label
        htmlFor={switchId}
        className={cn(
          "inline-flex cursor-pointer items-center gap-3 select-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {labelSide === "left" && (
          <span className="flex flex-col gap-0.5 text-right">
            <span className="text-body font-medium text-label">{label}</span>
            {description && (
              <span className="text-footnote text-label-secondary">{description}</span>
            )}
          </span>
        )}
        {switchEl}
        {labelSide === "right" && (
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-medium text-label">{label}</span>
            {description && (
              <span className="text-footnote text-label-secondary">{description}</span>
            )}
          </span>
        )}
      </label>
    );
  }
);

AppleSwitch.displayName = "AppleSwitch";

export { AppleSwitch, type AppleSwitchProps };
