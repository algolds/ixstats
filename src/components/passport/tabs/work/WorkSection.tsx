import React from "react";

/** A Work section title: a tinted icon and a headline over a hairline, with an optional trailing link. */
export function WorkSectionTitle({
  icon,
  children,
  trailing,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="border-separator flex items-center justify-between gap-3 border-b pb-2">
      <h2 className="text-headline flex min-w-0 items-center gap-2">
        {icon && (
          <span aria-hidden className="text-tint inline-flex shrink-0 [&_svg]:size-4">
            {icon}
          </span>
        )}
        <span className="min-w-0">{children}</span>
      </h2>
      {trailing}
    </div>
  );
}

/** Trailing action link (tint, never colour alone: text + arrow). */
export const WORK_LINK =
  "text-tint text-footnote rounded-control-sm focus-visible:outline-tint inline-flex shrink-0 cursor-pointer items-center gap-1 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

/** One hairline-separated row in a Work list. */
export const WORK_ROW = "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between";

export function formatWorkDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
