"use client";

import { useMemo, useState } from "react";
import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { focusRing } from "~/components/ui/button";
import { RarityMark } from "~/components/cards/face/RarityMark";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { FINISH_LABEL, rarityRank } from "~/lib/cards/face/labels";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MineRow } from "~/lib/cards/hub/mine";
import { cn } from "~/lib/utils/cn";

const HEAD = "px-3 py-2 font-medium";
/** Shown from the small breakpoint up; a phone keeps the card, its rarity and its value. */
const WIDE = "hidden sm:table-cell";

type SortColumn = "card" | "rarity" | "season" | "level" | "copies" | "value";
type SortDirection = "asc" | "desc";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: SortDirection
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

function compareMineRows(left: MineRow, right: MineRow, sort: SortState): number {
  const factor = sort.direction === "asc" ? 1 : -1;
  switch (sort.column) {
    case "card":
      return factor * left.face.title.localeCompare(right.face.title);
    case "rarity":
      return factor * (rarityRank(left.face.rarity) - rarityRank(right.face.rarity));
    case "season":
      return compareNullableNumbers(left.face.season, right.face.season, sort.direction);
    case "level":
      return compareNullableNumbers(
        left.face.copy?.level ?? null,
        right.face.copy?.level ?? null,
        sort.direction
      );
    case "copies":
      return factor * (left.copies - right.copies);
    case "value":
      return factor * (left.value - right.value);
  }
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  column: SortColumn;
  sort: SortState | null;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort?.column === column;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(HEAD, align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "rounded-control-sm hover:text-label inline-flex cursor-pointer items-center gap-1 font-medium transition-colors",
          align === "right" && "ml-auto",
          active && "text-label",
          focusRing
        )}
      >
        <span>{label}</span>
        {active && sort.direction === "asc" ? (
          <NavArrowUp aria-hidden className="size-3.5 shrink-0" />
        ) : (
          <NavArrowDown aria-hidden className={cn("size-3.5 shrink-0", !active && "opacity-35")} />
        )}
      </button>
    </th>
  );
}

function MineListRow({ row, onOpen }: { row: MineRow; onOpen: (face: CardFaceData) => void }) {
  const { face, copies } = row;
  return (
    <tr data-row onClick={() => onOpen(face)} className="border-separator cursor-pointer border-t">
      <td className="p-3">
        <button
          type="button"
          className={cn(
            "text-label rounded-control-sm text-left font-medium hover:underline",
            focusRing
          )}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(face);
          }}
        >
          {face.title}
        </button>
        {copies > 1 && (
          <span className="text-footnote text-label-secondary ml-2 tabular-nums sm:hidden">
            {copies.toLocaleString()} copies
          </span>
        )}
      </td>
      <td className={cn("p-3", WIDE)}>{face.realm.name}</td>
      <td className="p-3">
        <RarityMark rarity={face.rarity} />
      </td>
      <td className={cn("p-3 tabular-nums", WIDE)}>
        {face.season !== null ? `S${face.season}` : "–"}
      </td>
      <td className={cn("p-3", WIDE)}>{face.copy ? FINISH_LABEL[face.copy.finish] : "–"}</td>
      <td className="hidden p-3 tabular-nums md:table-cell">{face.copy?.level ?? "–"}</td>
      <td className={cn("p-3 tabular-nums", WIDE)}>{copies.toLocaleString()}</td>
      <td className="p-3 text-right tabular-nums">
        {/* A retired copy is worth nothing; say why beside the 0. */}
        {face.isRetired && <span className="text-footnote text-label-secondary mr-2">Retired</span>}
        <span className="inline-flex items-center gap-1">
          <IxCreditsSymbol className="size-[0.8em]" />
          {row.value.toLocaleString()}
        </span>
      </td>
    </tr>
  );
}

/** Mine as a list: sortable columns with a value readout. */
export function MineList({
  rows,
  onOpen,
}: {
  rows: readonly MineRow[];
  onOpen: (face: CardFaceData) => void;
}) {
  const [sort, setSort] = useState<SortState | null>(null);

  const toggleSort = (column: SortColumn) => {
    setSort((current) => {
      if (current?.column === column) {
        return { column, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: column === "card" ? "asc" : "desc" };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((left, right) => compareMineRows(left, right, sort));
  }, [rows, sort]);

  return (
    <Card content="data" padding="none" className="overflow-x-auto">
      <table className="text-callout w-full text-left">
        <caption className="sr-only">Your cards</caption>
        <thead className="text-footnote text-label-secondary">
          <tr>
            <SortableHeader label="Card" column="card" sort={sort} onSort={toggleSort} />
            <th scope="col" className={cn(HEAD, WIDE)}>
              Realm
            </th>
            <SortableHeader label="Rarity" column="rarity" sort={sort} onSort={toggleSort} />
            <SortableHeader
              label="Season"
              column="season"
              sort={sort}
              onSort={toggleSort}
              className={WIDE}
            />
            <th scope="col" className={cn(HEAD, WIDE)}>
              Finish
            </th>
            <SortableHeader
              label="Level"
              column="level"
              sort={sort}
              onSort={toggleSort}
              className="hidden md:table-cell"
            />
            <SortableHeader
              label="Copies"
              column="copies"
              sort={sort}
              onSort={toggleSort}
              className={WIDE}
            />
            <SortableHeader
              label="Value"
              column="value"
              sort={sort}
              onSort={toggleSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <MineListRow
              key={row.face.copy?.ownershipId ?? row.face.cardId}
              row={row}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </Card>
  );
}
