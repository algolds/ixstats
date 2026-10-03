"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";
import { focusRing, hitSlop } from "~/components/ui/button";
import { badgeTones, type BadgeTone } from "~/components/ui/badge";

/**
 * A compact pill action for social toolbars (like, repost, save, comment, share): neutral until
 * pressed, then tinted in its `tone` (the Badge palette).
 *
 * - Pass `pressed` for a toggle (`aria-pressed` is set); omit it for a one-shot action (share).
 * - `icon` is the leading glyph (decorative); children are the visible label; `count` follows it.
 * - An icon-only pill (no children) needs an `aria-label`.
 *
 * ```tsx
 * <ActionPill pressed={liked} tone="destructive" icon={<Heart />} count={likes} onClick={toggleLike}>
 *   Like
 * </ActionPill>
 * ```
 */

export type ActionPillTone = Exclude<BadgeTone, "default">;

const SIZE = {
  /** 24px tall, caption text: toolbars under a feed card. */
  sm: "gap-1 px-3 py-1 text-caption [:where(&)_svg]:size-3.5",
  /** 28px tall, footnote text: standalone action rows. */
  md: "h-(--control-height-sm) gap-1 px-3 text-footnote font-medium [:where(&)_svg]:size-4",
} as const;

export interface ActionPillProps extends Omit<React.ComponentProps<"button">, "children"> {
  /** Toggle state. Omit for a one-shot action (no `aria-pressed`). */
  pressed?: boolean;
  /** Pressed colour. @default "secondary" */
  tone?: ActionPillTone;
  /** Leading glyph (decorative). */
  icon?: React.ReactNode;
  /** Count after the label. */
  count?: React.ReactNode;
  /** @default "sm" */
  size?: keyof typeof SIZE;
  children?: React.ReactNode;
}

export const ActionPill = React.forwardRef<HTMLButtonElement, ActionPillProps>(
  (
    { pressed, tone = "secondary", icon, count, size = "sm", className, children, type, ...props },
    ref
  ) => {
    const isPressed = pressed === true;
    const hasCount = count != null && count !== false;
    return (
      <button
        // Caller props first: as a `PopoverTrigger asChild` child the trigger's own data-slot and
        // data-state must not replace the pill's.
        {...props}
        ref={ref}
        type={type ?? "button"}
        data-slot="action-pill"
        data-state={
          pressed === undefined
            ? ((props as Record<string, unknown>)["data-state"] as string | undefined)
            : isPressed
              ? "on"
              : "off"
        }
        aria-pressed={pressed === undefined ? props["aria-pressed"] : isPressed}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full whitespace-nowrap select-none",
          "facet-press facet-press-sm",
          focusRing,
          hitSlop,
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0",
          SIZE[size],
          isPressed ? badgeTones[tone] : "text-label-secondary hover:bg-fill-4 hover:text-label",
          className
        )}
      >
        {icon != null && icon !== false && (
          <span aria-hidden data-slot="action-pill-icon" className="inline-flex shrink-0">
            {icon}
          </span>
        )}
        {children}
        {hasCount && (
          <span data-slot="action-pill-count" className="tabular-nums">
            {count}
          </span>
        )}
      </button>
    );
  }
);
ActionPill.displayName = "ActionPill";
