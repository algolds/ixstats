import React from "react";
import { ArrowDown, ArrowUp, Minus } from "iconoir-react";
import { cn } from "~/lib/utils";
import { TONE_CLASSES } from "./directive-model";
import { Card } from "~/components/ui/card";

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

/**
 * A compact list of stat changes: label left, signed change right, coloured by who it helps.
 * A depth-3 Facet row group; solid, because it always sits inside a card.
 */
export function EffectList({ items, className }: { items: EffectItem[]; className?: string }) {
  return (
    <Card variant="well" padding="none" className={className}>
      <ul className="divide-separator divide-y">
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
            <li key={item.key} className="flex items-center gap-3 px-3 py-2">
              <Icon className={cn("h-4 w-4 shrink-0", tone.text)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-label text-body">{item.label}</p>
                {item.caption && (
                  <p className="text-label-secondary text-footnote">{item.caption}</p>
                )}
              </div>
              <span className={cn("text-headline shrink-0 tabular-nums", tone.text)}>
                {item.value}
              </span>
              {item.favorable != null && (
                <span className="sr-only">
                  {item.favorable ? "(favourable)" : "(unfavourable)"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
