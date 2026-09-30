import React from "react";
import { ArrowDown, ArrowUp, Minus } from "iconoir-react";
import { cn } from "~/lib/utils";
import { TONE_CLASSES } from "./directive-model";

export interface EffectItem {
  key: string;
  label: string;
  /** Signed, formatted change ("+1.5", "−0.3", "+0.058%"). */
  value: string;
  direction: "up" | "down" | "flat";
  /** Good for the nation? null when it cannot be judged. */
  favorable: boolean | null;
  caption?: string;
}

/** A compact list of stat changes: label left, signed change right, coloured by who it helps. */
export function EffectList({ items, className }: { items: EffectItem[]; className?: string }) {
  return (
    <ul className={cn("divide-border border-border divide-y rounded-xl border", className)}>
      {items.map((item) => {
        const tone =
          item.favorable == null
            ? TONE_CLASSES.neutral
            : item.favorable
              ? TONE_CLASSES.positive
              : TONE_CLASSES.negative;
        const Icon =
          item.direction === "up" ? ArrowUp : item.direction === "down" ? ArrowDown : Minus;
        return (
          <li key={item.key} className="flex items-center gap-3 px-3 py-2.5">
            <Icon className={cn("h-4 w-4 shrink-0", tone.text)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm">{item.label}</p>
              {item.caption && <p className="text-muted-foreground text-xs">{item.caption}</p>}
            </div>
            <span className={cn("shrink-0 text-sm font-semibold tabular-nums", tone.text)}>
              {item.value}
            </span>
            {item.favorable != null && (
              <span className="sr-only">{item.favorable ? "(favourable)" : "(unfavourable)"}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
