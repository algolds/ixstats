"use client";

import * as React from "react";

import { cn } from "~/lib/utils/cn";
import { isNumericText } from "~/lib/design/identity";

/**
 * Table (Facet 3 §7.1 data tables): an opaque `surface` group with `separator` hairlines between
 * rows — or, inside a `Card`/`FacetCard`, no surface of its own (the card is the surface).
 *
 * - Header cells: `text-footnote` in `label-secondary`, sentence case. `<TableHeader sticky>` pins
 *   the header while the table scrolls; give the table a height to scroll in with
 *   `containerClassName` (e.g. `max-h-96`), since a horizontally scrolling container is also the
 *   vertical scroll container for sticky cells.
 * - Body cells: `text-callout` with tabular numerals, so figures line up. Facet 3.1: a cell whose
 *   content is a figure (a number, or text such as "1,204" / "+2.4%") is set in the data face
 *   (`font-data`: mono, slashed zero) automatically; `numeric` forces it and right-aligns the
 *   column (pass `numeric` on its `TableHead` too).
 * - Rows: `fill-4` hover; a selected row (`data-state="selected"` or `aria-selected`) takes the
 *   `tint-fill`.
 * - Wide tables scroll horizontally; the clipped edge fades out (a `mask-image`, so it works on
 *   any background) only while there is more to scroll to.
 */

type OverflowEdge = "none" | "start" | "end" | "both";

function useHorizontalOverflow(ref: React.RefObject<HTMLDivElement | null>): OverflowEdge {
  const [edge, setEdge] = React.useState<OverflowEdge>("none");

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return setEdge("none");
      // RTL scrollers report negative scrollLeft; the magnitude is what matters.
      const left = Math.abs(el.scrollLeft);
      const atStart = left <= 1;
      const atEnd = left >= max - 1;
      setEdge(atStart ? "end" : atEnd ? "start" : "both");
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

  return edge;
}

interface TableProps extends React.ComponentProps<"table"> {
  /** Classes for the outer container (e.g. a `max-h-*` so a sticky header has room to scroll). */
  containerClassName?: string;
}

function Table({ className, containerClassName, ...props }: TableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const overflow = useHorizontalOverflow(scrollRef);

  return (
    <div
      data-slot="table-container"
      className={cn(
        "bg-surface border-separator rounded-card relative flex w-full min-w-0 flex-col overflow-hidden border",
        // Inside a card the card is the surface: no second border, fill or radius.
        "in-data-[slot=card]:rounded-none in-data-[slot=card]:border-0 in-data-[slot=card]:bg-transparent",
        "in-data-[slot=facet-card]:rounded-none in-data-[slot=facet-card]:border-0 in-data-[slot=facet-card]:bg-transparent",
        containerClassName
      )}
    >
      <div
        ref={scrollRef}
        data-slot="table-scroll"
        data-overflow={overflow}
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

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-surface-secondary border-separator text-label border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
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
  /** A figures column: right-aligned (and, on cells, the data face). */
  numeric?: boolean;
}

function TableHead({
  className,
  numeric,
  ...props
}: React.ComponentProps<"th"> & NumericCellProps) {
  return (
    <th
      data-slot="table-head"
      data-numeric={numeric || undefined}
      className={cn(
        "text-footnote text-label-secondary h-10 px-3 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  numeric,
  ...props
}: React.ComponentProps<"td"> & NumericCellProps) {
  const figure = numeric ?? isNumericText(props.children);
  return (
    <td
      data-slot="table-cell"
      data-numeric={figure || undefined}
      className={cn(
        "text-callout px-3 py-3 align-middle whitespace-nowrap tabular-nums [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        figure && "font-data",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-footnote text-label-secondary mt-4", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
