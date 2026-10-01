"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";
import { focusRing, hitSlop } from "~/components/ui/button";
import { SYSTEM_TINTED, type SystemTintedColor } from "~/components/ui/badge";

/**
 * ActionPill (spec §7.2): a compact, pill-shaped action for social toolbars — like, repost,
 * save/stash, comment, share. Neutral (`label-secondary`, a `fill-4` hover wash) until pressed;
 * pressed it takes a tinted fill in its `tone` (`tint` by default, or a system colour such as
 * `red` for a like), the same AA-checked fill/ink pairs as the colour `Badge`s.
 *
 * - Pass `pressed` for a toggle (`aria-pressed` is set); omit it for a one-shot action (share).
 * - `icon` is the leading glyph (14px, `aria-hidden`); children are the visible label.
 * - `count` renders after the label in the data face (`font-data`: mono, tabular, slashed zero;
 *   hidden when `null`/`undefined`/`false`).
 * - Presses with the Facet 3.1 small-control physics (`facet-press-sm`).
 * - An icon-only pill (no children) needs an `aria-label`.
 * - It forwards its ref and props, so it works as a `PopoverTrigger asChild` / `MenuButton` child.
 *
 * ```tsx
 * <ActionPill pressed={liked} tone="red" icon={<Heart />} count={likes} onClick={toggleLike}>
 *   Like
 * </ActionPill>
 * ```
 */

export type ActionPillTone = "tint" | SystemTintedColor;

const TONE_PRESSED: Record<ActionPillTone, string> = {
  tint: "bg-tint-fill text-tint-ink hover:bg-tint/20 hover:text-tint-ink",
  red: `${SYSTEM_TINTED.red} hover:bg-red/25 hover:text-red-ink`,
  orange: `${SYSTEM_TINTED.orange} hover:bg-orange/25 hover:text-orange-ink`,
  yellow: `${SYSTEM_TINTED.yellow} hover:bg-yellow/25 hover:text-yellow-ink`,
  green: `${SYSTEM_TINTED.green} hover:bg-green/25 hover:text-green-ink`,
  mint: `${SYSTEM_TINTED.mint} hover:bg-mint/25 hover:text-mint-ink`,
  teal: `${SYSTEM_TINTED.teal} hover:bg-teal/25 hover:text-teal-ink`,
  cyan: `${SYSTEM_TINTED.cyan} hover:bg-cyan/25 hover:text-cyan-ink`,
  blue: `${SYSTEM_TINTED.blue} hover:bg-blue/25 hover:text-blue-ink`,
  indigo: `${SYSTEM_TINTED.indigo} hover:bg-indigo/25 hover:text-indigo-ink`,
  purple: `${SYSTEM_TINTED.purple} hover:bg-purple/25 hover:text-purple-ink`,
  pink: `${SYSTEM_TINTED.pink} hover:bg-pink/25 hover:text-pink-ink`,
  brown: `${SYSTEM_TINTED.brown} hover:bg-brown/25 hover:text-brown-ink`,
  gray: `${SYSTEM_TINTED.gray} hover:bg-gray/25 hover:text-gray-ink`,
};

const SIZE = {
  /** 24px tall, caption text: toolbars under a feed card. */
  sm: "gap-1 px-3 py-1 text-caption [:where(&)_svg]:size-3.5",
  /** 28px tall, footnote text: standalone action rows. */
  md: "h-(--control-height-sm) gap-1 px-3 text-footnote font-medium [:where(&)_svg]:size-4",
} as const;

export interface ActionPillProps extends Omit<React.ComponentProps<"button">, "children"> {
  /** Toggle state. Omit for a one-shot action (no `aria-pressed`). */
  pressed?: boolean;
  /** Pressed colour. @default "tint" */
  tone?: ActionPillTone;
  /** Leading glyph (decorative). */
  icon?: React.ReactNode;
  /** Count after the label, in tabular numerals. */
  count?: React.ReactNode;
  /** @default "sm" */
  size?: keyof typeof SIZE;
  children?: React.ReactNode;
}

export const ActionPill = React.forwardRef<HTMLButtonElement, ActionPillProps>(
  (
    { pressed, tone = "tint", icon, count, size = "sm", className, children, type, ...props },
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
        data-tone={tone}
        aria-pressed={pressed === undefined ? props["aria-pressed"] : isPressed}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full whitespace-nowrap select-none",
          "text-label-secondary hover:bg-fill-4 hover:text-label",
          // Facet 3.1 press physics (small-control scale .95, off under Reduce Motion).
          "facet-press facet-press-sm",
          focusRing,
          hitSlop,
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0",
          SIZE[size],
          isPressed && TONE_PRESSED[tone],
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
          <span data-slot="action-pill-count" className="font-data tabular-nums">
            {count}
          </span>
        )}
      </button>
    );
  }
);
ActionPill.displayName = "ActionPill";
