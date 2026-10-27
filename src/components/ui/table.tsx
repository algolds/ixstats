"use client";

import * as React from "react";

import { cn } from "~/lib/utils/cn";

/**
 * Table: an opaque `surface` group with `separator` hairlines between rows, or, inside a `Card`,
 * no surface of its own.
 *
 * - Header cells are `text-footnote` in `label-secondary`. `<TableHeader sticky>` pins the header
 *   while the table scrolls; give the table a height with `containerClassName` (e.g. `max-h-96`).
 * - Body cells are `text-callout` with tabular numerals; `numeric` right-aligns a figures column
 *   (pass it on its `TableHead` too).
 * - A selected row (`data-state="selected"` or `aria-selected`) takes the `tint-fill`.
 * - Wide tables scroll horizontally; the clipped edge fades out only while there is more to scroll to.
 * - `pinned` on the last column's head and cells (a row's actions) keeps it in view at the end edge while a table
 *   too wide for its container scrolls, as on a phone, on the table's surface with a hairline; that edge then does
 *   not fade. A table that fits shows it as any other column.
 */

type OverflowEdge = "none" | "start" | "end" | "both";

/** The edges hiding more of the table: the start once scrolled from it, the end until scrolled to it. */
function fadingEdge(hiddenStart: boolean, hiddenEnd: boolean): OverflowEdge {
  if (hiddenStart && hiddenEnd) return "both";
  if (hiddenStart) return "start";
  return hiddenEnd ? "end" : "none";
}

/** Which edges fade, and whether the table is wider than its container at all. */
function useHorizontalOverflow(ref: React.RefObject<HTMLDivElement | null>): {
  edge: OverflowEdge;
  scrolls: boolean;
} {
  const [edge, setEdge] = React.useState<OverflowEdge>("none");
  const [scrolls, setScrolls] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setScrolls(max > 1);
      if (max <= 1) return setEdge("none");
      // RTL scrollers report negative scrollLeft; the magnitude is what matters.
      const left = Math.abs(el.scrollLeft);
      // A pinned column stays at the end edge, so that edge never hides anything.
      const pinned = el.querySelector("[data-pinned]") !== null;
      setEdge(fadingEdge(left > 1, !pinned && left < max - 1));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    const table = el.querySelector("table");
    if (table) observer?.observe(table);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [ref]);

  return { edge, scrolls };
}

interface TableProps extends React.ComponentProps<"table"> {
  /** Classes for the outer container (e.g. a `max-h-*` so a sticky header has room to scroll). */
  containerClassName?: string;
}

function Table({ className, containerClassName, ...props }: TableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { edge: overflow, scrolls } = useHorizontalOverflow(scrollRef);

  return (
    <div
      data-slot="table-container"
      className={cn(
        "bg-surface border-separator rounded-card relative flex w-full min-w-0 flex-col overflow-hidden border",
        // Inside a card the card is the surface: no second border, fill or radius.
        "in-data-[slot=card]:rounded-none in-data-[slot=card]:border-0 in-data-[slot=card]:bg-transparent",
        containerClassName
      )}
    >
      <div
        ref={scrollRef}
        data-slot="table-scroll"
        data-overflow={overflow}
        data-scrolls={scrolls || undefined}
        className={cn(
          "min-h-0 w-full flex-1 overflow-auto overscroll-x-contain",
          "data-[overflow=end]:[mask-image:linear-gradient(to_right,black_calc(100%_-_2rem),transparent)]",
          "data-[overflow=start]:[mask-image:linear-gradient(to_left,black_calc(100%_-_2rem),transparent)]",
          "data-[overflow=both]:[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%_-_2rem),transparent)]"
        )}
      >
        <table
          data-slot="table"
          className={cn(
            "text-callout text-label w-full min-w-full caption-bottom border-collapse tabular-nums",
            className
          )}
          {...props}
        />
      </div>
    </div>
  );
}

interface TableHeaderProps extends React.ComponentProps<"thead"> {
  /** Pin the header row to the top of the table's scroll container. */
  sticky?: boolean;
}

function TableHeader({ className, sticky = false, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      data-sticky={sticky || undefined}
      className={cn(
        "[&_tr]:border-separator [&_tr]:border-b",
        // Collapsed borders do not travel with sticky cells, so the hairline is an inset shadow.
        sticky &&
          "[&_th]:bg-surface [&_th]:z-raised [&_th]:sticky [&_th]:top-0 [&_th]:shadow-[inset_0_-1px_0_var(--color-separator)]",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-separator hover:bg-fill-4 ease-out-facet border-b transition-colors duration-150",
        "aria-selected:bg-tint-fill data-[state=selected]:bg-tint-fill",
        className
      )}
      {...props}
    />
  );
}

interface NumericCellProps {
  /** A figures column: right-aligned. */
  numeric?: boolean;
  /** The last column (a row's actions): kept in view at the end edge while the table scrolls sideways. */
  pinned?: boolean;
}

// Only while the table scrolls (`data-scrolls`), so a table that fits is unchanged. Collapsed borders do not travel
// with sticky cells, so the hairline is an inset shadow, as on the sticky header.
const pinnedCellClassName =
  "in-data-[scrolls]:bg-surface in-data-[scrolls]:sticky in-data-[scrolls]:right-0 in-data-[scrolls]:shadow-[inset_1px_0_0_var(--color-separator)]";

function TableHead({
  className,
  numeric,
  pinned,
  ...props
}: React.ComponentProps<"th"> & NumericCellProps) {
  return (
    <th
      data-slot="table-head"
      data-pinned={pinned || undefined}
      className={cn(
        "text-footnote text-label-secondary h-10 px-3 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        numeric && "text-right",
        pinned && pinnedCellClassName,
        className
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  numeric,
  pinned,
  ...props
}: React.ComponentProps<"td"> & NumericCellProps) {
  return (
    <td
      data-slot="table-cell"
      data-pinned={pinned || undefined}
      className={cn(
        "text-callout px-3 py-3 align-middle whitespace-nowrap tabular-nums [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        numeric && "text-right",
        pinned && pinnedCellClassName,
        className
      )}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
