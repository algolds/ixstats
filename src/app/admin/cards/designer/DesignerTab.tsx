"use client";
/** The Designer: the Special cards, event and achievement reward, and their editor. */
import { useState } from "react";
import { Plus, Star } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { awaitsSpecialCardImport } from "~/lib/cards/special-card-import";
import { RARITY_LABELS, labelOf } from "../shared/card-labels";
import { EMPTY_DRAFT, SpecialCardSheet, type SpecialCardDraft } from "./SpecialCardSheet";

type Row = RouterOutputs["cards"]["admin"]["designer"]["list"][number];

const draftOf = (row: Row): SpecialCardDraft => ({
  id: row.id,
  title: row.title,
  description: row.description ?? "",
  rarity: row.rarity,
  kind: row.specialKind ?? "EVENT",
  realmId: row.realmId,
  artwork: row.artwork ?? "",
  isBound: row.isBound,
  rewardAchievementKey: row.rewardAchievementKey ?? "",
});

/** Names by id; an id a map lacks shows as itself. */
type Names = Readonly<Record<string, string>>;

function kindLabel(row: Row, achievementNames: Names): string {
  if (awaitsSpecialCardImport(row)) return "Waiting for the Special card import";
  if (row.specialKind === "ACHIEVEMENT_REWARD" && row.rewardAchievementKey) {
    return `Reward for ${labelOf(achievementNames, row.rewardAchievementKey)}`;
  }
  return "Event card";
}

function SpecialCardsTable({
  rows,
  achievementNames,
  realmNames,
  onEdit,
}: {
  rows: Row[];
  achievementNames: Names;
  realmNames: Names;
  onEdit: (row: Row) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Card</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Rarity</TableHead>
          <TableHead>Realm</TableHead>
          <TableHead className="text-right">Copies</TableHead>
          <TableHead>
            <span className="sr-only">Edit</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <span className="flex flex-wrap items-center gap-2">
                {row.title}
                {row.isBound && <Badge variant="secondary">Bound</Badge>}
                {row.isRetired && <Badge variant="outline">Retired</Badge>}
              </span>
            </TableCell>
            <TableCell>{kindLabel(row, achievementNames)}</TableCell>
            <TableCell>{labelOf(RARITY_LABELS, row.rarity)}</TableCell>
            <TableCell>{labelOf(realmNames, row.realmId)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row._count.CardOwnership.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit ${row.title}`}
                disabled={awaitsSpecialCardImport(row)}
                onClick={() => onEdit(row)}
              >
                Edit
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DesignerTab() {
  // Keyed by card below, so switching cards always starts from that card's stored values
  const [editing, setEditing] = useState<{ draft: SpecialCardDraft; copies: number } | null>(null);
  const list = api.cards.admin.designer.list.useQuery();
  const achievements = api.cards.admin.designer.achievements.useQuery();
  const realms = api.cards.admin.overview.realms.useQuery();
  const achievementNames = Object.fromEntries(
    (achievements.data ?? []).map((achievement) => [achievement.id, achievement.title])
  );
  const realmNames = Object.fromEntries((realms.data ?? []).map((realm) => [realm.id, realm.name]));

  return (
    <Card content="data">
      <CardHeader className="flex flex-row items-center justify-between pt-5">
        <CardTitle icon={<Star />}>Special cards</CardTitle>
        <Button size="sm" onClick={() => setEditing({ draft: EMPTY_DRAFT, copies: 0 })}>
          <Plus />
          New Special card
        </Button>
      </CardHeader>
      <CardContent className="pb-5">
        {list.isError && (
          <p role="alert" className="text-destructive text-footnote">
            The Special cards did not load. Reload the page to try again.
          </p>
        )}
        {list.data?.length === 0 && (
          <EmptyState
            compact
            icon={<Star />}
            title="No Special cards yet"
            message="Make the first one with New Special card."
          />
        )}
        {list.data && list.data.length > 0 && (
          <SpecialCardsTable
            rows={list.data}
            achievementNames={achievementNames}
            realmNames={realmNames}
            onEdit={(row) => setEditing({ draft: draftOf(row), copies: row._count.CardOwnership })}
          />
        )}
      </CardContent>
      {editing && (
        <SpecialCardSheet
          key={editing.draft.id ?? "new"}
          draft={editing.draft}
          copies={editing.copies}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </Card>
  );
}
