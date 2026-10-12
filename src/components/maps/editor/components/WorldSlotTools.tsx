"use client";

import { useId } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { useRealmMapDisplay } from "~/components/maps/core/hooks/useRealmMapDisplay";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { invalidateMapViews } from "../hooks/state/geo-invalidation";
import { confirmEditorAction } from "./EditorConfirmDialog";

interface WorldSlotToolsProps {
  countryId: string;
  countryName: string;
  /** The slot is gone: the editor drops it from the selection */
  onDeleted: () => void;
}

/**
 * The inspector's tools for a nation slot the world generator made: whether players may claim it, and deleting it
 * while nobody holds it or has claimed it. Shows nothing for any other country, and nothing on Ixnay.
 */
export function WorldSlotTools({ countryId, countryName, onDeleted }: WorldSlotToolsProps) {
  const display = useRealmMapDisplay();
  const realm = display?.realmSlug ?? null;
  const labelId = useId();
  const utils = api.useUtils();
  const notify = useNotify();

  const { data: slot } = api.realms.map.worldSlot.useQuery(
    { realm: realm ?? "", countryId },
    { enabled: !!realm && !display?.isIxnay, retry: false, staleTime: 10_000 }
  );
  const setClaimable = api.realms.map.setSlotClaimable.useMutation({
    onSuccess: () => void utils.realms.map.worldSlot.invalidate(),
    onError: (error) => notify.error("Could not change the slot", error.message),
  });
  const remove = api.realms.map.deleteSlot.useMutation({
    onSuccess: () => {
      notify.success(`${countryName} deleted`, "Its land stays on the map, with no nation.");
      invalidateMapViews(utils, { list: true, stats: true });
      void utils.countries.getAll.invalidate();
      onDeleted();
    },
    onError: (error) => notify.error("Could not delete the slot", error.message),
  });

  if (!realm || display?.isIxnay || !slot?.worldgen) return null;

  const deletable = !slot.owned && slot.claims === 0;
  // A held nation is no scenery: it stays claimable (and can't be deleted) while a player holds it
  const locked = slot.owned && slot.claimable;
  const confirmDelete = async () => {
    const confirmed = await confirmEditorAction({
      title: `Delete ${countryName}?`,
      description: "The slot is removed. Its land stays on the map as a region with no nation.",
      confirmLabel: "Delete slot",
      destructive: true,
    });
    if (confirmed) remove.mutate({ realm, countryId });
  };

  return (
    <Card content="input" padding="sm" className="space-y-2">
      <h3 className="text-label text-caption font-semibold">Nation slot</h3>
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="text-label text-footnote">
          Claimable
        </span>
        <Switch
          aria-labelledby={labelId}
          checked={slot.claimable}
          disabled={setClaimable.isPending || locked}
          onCheckedChange={(next) => setClaimable.mutate({ realm, countryId, claimable: next })}
        />
      </div>
      {slot.owned ? (
        <p className="text-label-secondary text-caption">
          A player holds this nation.{" "}
          {locked ? "It can't be reserved or deleted." : "It can be made claimable again."}
        </p>
      ) : (
        <p className="text-label-secondary text-caption">
          {slot.claimable
            ? "Players can claim this nation."
            : "Reserved: players can't claim this nation."}
        </p>
      )}
      {!slot.owned &&
        (deletable ? (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive w-full"
            disabled={remove.isPending}
            onClick={() => void confirmDelete()}
          >
            Delete slot
          </Button>
        ) : (
          <p className="text-label-secondary text-caption">
            This nation has a claim. It can't be deleted.
          </p>
        ))}
    </Card>
  );
}
