"use client";

import { Card } from "~/components/ui/card";
import { focusRing } from "~/components/ui/button";
import { RarityMark } from "~/components/cards/face/RarityMark";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MineRow } from "~/lib/cards/hub/mine";
import { cn } from "~/lib/utils/cn";

const HEAD = "px-3 py-2 font-medium";
/** Shown from the small breakpoint up; a phone keeps the card, its rarity and its value. */
const WIDE = "hidden sm:table-cell";

function MineListRow({ row, onOpen }: { row: MineRow; onOpen: (face: CardFaceData) => void }) {
  const { face, copies } = row;
  return (
    <tr className="border-separator border-t">
      <td className="p-3">
        <button
          type="button"
          className={cn("text-label rounded-control-sm text-left hover:underline", focusRing)}
          onClick={() => onOpen(face)}
        >
          {face.title}
        </button>
        {copies > 1 && (
          <span className="text-footnote text-label-secondary ml-2">{copies} copies</span>
        )}
      </td>
      <td className={cn("p-3", WIDE)}>{face.realm.name}</td>
      <td className="p-3">
        <RarityMark rarity={face.rarity} />
      </td>
      <td className={cn("p-3", WIDE)}>{face.copy ? FINISH_LABEL[face.copy.finish] : "–"}</td>
      <td className="hidden p-3 md:table-cell">{face.copy?.level ?? "–"}</td>
      <td className="p-3 text-right">
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

/** Mine as a list: the only card view with a value column. */
export function MineList({
  rows,
  onOpen,
}: {
  rows: readonly MineRow[];
  onOpen: (face: CardFaceData) => void;
}) {
  return (
    <Card content="data" padding="none" className="overflow-x-auto">
      <table className="text-callout w-full text-left">
        <caption className="sr-only">Your cards</caption>
        <thead className="text-footnote text-label-secondary">
          <tr>
            <th scope="col" className={HEAD}>
              Card
            </th>
            <th scope="col" className={cn(HEAD, WIDE)}>
              Realm
            </th>
            <th scope="col" className={HEAD}>
              Rarity
            </th>
            <th scope="col" className={cn(HEAD, WIDE)}>
              Finish
            </th>
            <th scope="col" className={cn(HEAD, "hidden md:table-cell")}>
              Level
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
