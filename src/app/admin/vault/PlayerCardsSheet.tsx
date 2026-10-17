"use client";
/** One player's cards, packs, auctions and trades, with the admin tools on them. */
import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { CopiesSection } from "./player-cards/CopiesSection";
import { MarketSection } from "./player-cards/MarketSection";
import { PacksSection } from "./player-cards/PacksSection";

export interface PlayerRef {
  id: string;
  displayName: string;
}

type Inventory = RouterOutputs["cards"]["admin"]["tools"]["playerCards"];
type Section = "copies" | "packs" | "market";

const panelId = (section: Section) => `player-cards-${section}`;

function capacityLine({ copyCount, room }: Pick<Inventory, "copyCount" | "room">): string {
  const copies = `${copyCount.toLocaleString()} ${copyCount === 1 ? "copy" : "copies"}`;
  if (room === null) return `${copies} · no limit`;
  return room === 0
    ? `${copies} · inventory full`
    : `${copies} · room for ${room.toLocaleString()} more`;
}

function SectionPanel({
  section,
  userId,
  data,
}: {
  section: Section;
  userId: string;
  data: Inventory;
}) {
  if (section === "packs") return <PacksSection userId={userId} packs={data.packs} />;
  if (section === "market") {
    return <MarketSection userId={userId} auctions={data.auctions} trades={data.trades} />;
  }
  return <CopiesSection userId={userId} copies={data.copies} copyCount={data.copyCount} />;
}

export function PlayerCardsSheet({
  player,
  onOpenChange,
}: {
  player: PlayerRef | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [section, setSection] = useState<Section>("copies");
  const inventory = api.cards.admin.tools.playerCards.useQuery(
    { userId: player?.id ?? "" },
    { enabled: player !== null }
  );
  const data = inventory.data;
  const live = data ? data.auctions.length + data.trades.length : 0;

  return (
    <Sheet open={player !== null} onOpenChange={onOpenChange}>
      <SheetContent size="wide" className="flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>{player ? `${player.displayName}'s cards` : "Cards"}</SheetTitle>
          <SheetDescription>{data ? capacityLine(data) : "Loading"}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
          <SegmentedControl
            asTabs
            aria-label="Player cards"
            value={section}
            onValueChange={setSection}
            getTabPanelId={panelId}
            options={[
              { value: "copies", label: "Cards" },
              {
                value: "packs",
                label: "Packs",
                badge: data?.packs.length || undefined,
                badgeLabel: `${data?.packs.length ?? 0} unopened`,
              },
              {
                value: "market",
                label: "Auctions and trades",
                badge: live || undefined,
                badgeLabel: `${live} live`,
              },
            ]}
          />
          <div role="tabpanel" id={panelId(section)}>
            {inventory.error ? (
              <EmptyState
                compact
                title="This player's cards did not load"
                message={inventory.error.message}
              />
            ) : !data || !player ? (
              <Skeleton className="h-40" />
            ) : (
              <SectionPanel section={section} userId={player.id} data={data} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
