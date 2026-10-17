"use client";
/** Packs: every pack with its price, size, guarantee and issues; open one in the editor, or put it on or off sale. */
import { useState } from "react";
import { Package, Plus } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { RARITY_LABELS, labelOf } from "../shared/card-labels";
import { PackEditorSheet } from "./PackEditorSheet";

type Pack = RouterOutputs["cards"]["admin"]["packs"]["list"][number];

function PacksTable({
  packs,
  onEdit,
  onActiveChange,
}: {
  packs: Pack[];
  onEdit: (pack: Pack) => void;
  onActiveChange: (pack: Pack, isActive: boolean) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pack</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Cards</TableHead>
          <TableHead>Guarantee</TableHead>
          <TableHead className="text-right">Issued</TableHead>
          <TableHead>On sale</TableHead>
          <TableHead pinned>
            <span className="sr-only">Edit</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {packs.map((pack) => (
          <TableRow key={pack.id}>
            <TableCell>{pack.name}</TableCell>
            <TableCell className="text-right tabular-nums">
              {pack.priceCredits.toLocaleString()} IxC
            </TableCell>
            <TableCell className="text-right tabular-nums">{pack.cardCount}</TableCell>
            <TableCell>
              {pack.guaranteedRarity ? labelOf(RARITY_LABELS, pack.guaranteedRarity) : "–"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {pack._count.UserPack.toLocaleString()}
            </TableCell>
            <TableCell>
              <Switch
                aria-label={`${pack.name} on sale`}
                checked={pack.isActive}
                onCheckedChange={(isActive) => onActiveChange(pack, isActive)}
              />
            </TableCell>
            <TableCell pinned className="text-right">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit ${pack.name}`}
                onClick={() => onEdit(pack)}
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

export function PacksTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const packs = api.cards.admin.packs.list.useQuery();
  // Keyed by pack below, so switching packs always starts from that pack's stored values
  const [editing, setEditing] = useState<{ pack: Pack | null } | null>(null);
  const setActive = api.cards.admin.packs.setActive.useMutation({
    onSuccess: () => void utils.cards.admin.packs.list.invalidate(),
    onError: (error) => notify.error("Pack not changed", error.message),
  });

  return (
    <Card content="data">
      <CardHeader className="flex flex-row items-center justify-between pt-5">
        <CardTitle icon={<Package />}>Packs</CardTitle>
        <Button size="sm" onClick={() => setEditing({ pack: null })}>
          <Plus />
          New pack
        </Button>
      </CardHeader>
      <CardContent className="pb-5">
        {packs.isError && (
          <p role="alert" className="text-destructive text-footnote">
            The packs did not load. Reload the page to try again.
          </p>
        )}
        {packs.data?.length === 0 && (
          <EmptyState
            compact
            icon={<Package />}
            title="No packs yet"
            message="Make the first one with New pack."
          />
        )}
        {packs.data && packs.data.length > 0 && (
          <PacksTable
            packs={packs.data}
            onEdit={(pack) => setEditing({ pack })}
            onActiveChange={(pack, isActive) => setActive.mutate({ packId: pack.id, isActive })}
          />
        )}
      </CardContent>
      {editing && (
        <PackEditorSheet
          key={editing.pack?.id ?? "new"}
          pack={editing.pack}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </Card>
  );
}
