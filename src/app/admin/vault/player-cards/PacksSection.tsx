"use client";
/** A player's unopened packs, and awarding one. */
import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Label } from "~/components/ui/label";
import { ValueSelect } from "~/components/ui/value-select";

type Pack = RouterOutputs["cards"]["admin"]["tools"]["playerCards"]["packs"][number];

export function PacksSection({ userId, packs }: { userId: string; packs: readonly Pack[] }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [packId, setPackId] = useState("");
  const catalogue = api.cards.admin.packs.list.useQuery();
  const award = api.cards.admin.tools.awardPack.useMutation({
    onSuccess: () => {
      notify.success("Pack awarded");
      setPackId("");
      void utils.cards.admin.tools.playerCards.invalidate({ userId });
    },
    onError: (error) => notify.error("Pack not awarded", error.message),
  });
  // Every pack, as before: an event pack is often off sale but still given out
  const options = (catalogue.data ?? []).map(
    (pack) =>
      [
        pack.id,
        `${pack.name} · ${pack.cardCount} cards${pack.isActive ? "" : " · not on sale"}`,
      ] as const
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="award-pack">Award a pack</Label>
          <ValueSelect
            id="award-pack"
            value={packId}
            onValueChange={setPackId}
            options={options}
            placeholder="Choose a pack"
          />
        </div>
        <Button
          disabled={packId === "" || award.isPending}
          onClick={() => award.mutate({ userId, packId })}
        >
          Award pack
        </Button>
      </div>
      {packs.length === 0 ? (
        <EmptyState compact title="No unopened packs" />
      ) : (
        <FacetList>
          <FacetListSection header="Unopened packs">
            {packs.map((pack) => (
              <FacetRow
                key={pack.id}
                title={pack.name}
                trailing={new Date(pack.acquiredDate).toLocaleDateString()}
              />
            ))}
          </FacetListSection>
        </FacetList>
      )}
    </div>
  );
}
