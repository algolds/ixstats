"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { useCardHubTab } from "~/hooks/useCardHubTab";
import { useCardSheet } from "~/hooks/useCardSheet";
import { marketTabOf, STORE_PATH, type CardHubTab } from "~/lib/cards/hub-routes";
import { addressWith } from "~/lib/utils/address";
import { ExplorePane } from "./ExplorePane";
import { MinePane } from "./MinePane";
import { NewShowcaseAction, SetsPane } from "./SetsPane";
import { CreateAuctionModal } from "./market/CreateAuctionModal";
import { MarketPane } from "./market/MarketPane";

const ROUTE_HEADERS: Record<CardHubTab, { title: string; subtitle: string }> = {
  mine: {
    title: "My cards",
    subtitle: "Your personal binder, showcase pins, and duplicate copies.",
  },
  sets: {
    title: "Sets",
    subtitle: "Season albums, regional series, and completion progress.",
  },
  market: {
    title: "Card market",
    subtitle: "Live player auctions, direct card trades, and wishlists.",
  },
  explore: {
    title: "Explore cards",
    subtitle: "Complete reference index of every card minted across seasons and realms.",
  },
};

/** Rewrites one query parameter of the hub's address, keeping its fragment; `push` makes a step Back undoes. */
function setParam(key: string, value: string | null, push = false) {
  const next = addressWith(window.location.href, (query) => {
    if (value) query.set(key, value);
    else query.delete(key);
  });
  if (push) window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

function hubHeaderAction(args: {
  tab: CardHubTab;
  showcaseId: string | null;
  onListCard: () => void;
  onShowcaseSaved: (id: string) => void;
  onSuggest: () => void;
}): ReactNode {
  if (args.tab === "mine") {
    return (
      <>
        <Button variant="secondary" size="sm" asChild>
          <Link href={STORE_PATH}>Get packs</Link>
        </Button>
        <Button size="sm" onClick={args.onListCard}>
          <Plus aria-hidden />
          List a card
        </Button>
      </>
    );
  }
  if (args.tab === "sets" && args.showcaseId === null) {
    return <NewShowcaseAction onSaved={args.onShowcaseSaved} />;
  }
  if (args.tab === "explore") {
    return (
      <Button size="sm" onClick={args.onSuggest}>
        <Plus aria-hidden />
        Suggest a card
      </Button>
    );
  }
  return undefined;
}

const CARDS_HUB_OPTIONS = [
  { value: "mine", label: "My cards" },
  { value: "sets", label: "Sets" },
  { value: "market", label: "Market" },
  { value: "explore", label: "Explore" },
] as const satisfies ReadonlyArray<{ value: CardHubTab; label: string }>;

/** Per-route Cards shell: My cards, Sets, Card market, and Explore cards, switched in place via SegmentedControl. */
export function CardsHub({ initialTab }: { initialTab: CardHubTab }) {
  const { tab, navigate } = useCardHubTab(initialTab);
  const sheet = useCardSheet();
  const params = useSearchParams();
  const param = (key: string) => params?.get(key) || null;
  const [selling, setSelling] = useState(false);

  const header = ROUTE_HEADERS[tab];
  const marketTab = marketTabOf(param("tab"));
  const showcaseId = param("showcase");
  const sellOwnershipId = param("sell");
  const tradeParam = param("trade");
  const trade = tradeParam
    ? {
        trade: tradeParam,
        partner: param("partner"),
        give: param("give"),
        get: param("get"),
      }
    : null;

  const closeTrade = () => {
    const next = addressWith(window.location.href, (query) => {
      for (const key of ["trade", "partner", "give", "get"]) query.delete(key);
    });
    window.history.replaceState(null, "", next);
  };

  const browseMarketForCard = (cardId: string) => {
    const next = addressWith(window.location.href, (query) => {
      query.delete("tab");
      query.set("for", cardId);
    });
    window.history.replaceState(null, "", next);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
        bleed
        actions={hubHeaderAction({
          tab,
          showcaseId,
          onListCard: () => setSelling(true),
          onShowcaseSaved: (id) => setParam("showcase", id, true),
          onSuggest: () => setParam("suggest", "1"),
        })}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Cards views"
          size="sm"
          value={tab}
          onValueChange={navigate}
          options={CARDS_HUB_OPTIONS}
        />
        <Button variant="secondary" size="sm" asChild>
          <Link href="/vault/import">Import deck</Link>
        </Button>
      </div>
      {tab === "mine" && <MinePane onOpenCard={sheet.open} />}
      {tab === "sets" && (
        <SetsPane
          onOpenCard={sheet.open}
          showcaseId={showcaseId}
          onShowcaseChange={(id) => setParam("showcase", id, id !== null)}
        />
      )}
      {tab === "market" && (
        <MarketPane
          tab={marketTab}
          onTabChange={(next) => setParam("tab", next === "browse" ? null : next)}
          forCardId={param("for")}
          onClearFor={() => setParam("for", null)}
          onBrowseForCard={browseMarketForCard}
          onSellOpen={() => setSelling(true)}
          onOpenCard={sheet.open}
          trade={trade}
          onCloseTrade={closeTrade}
        />
      )}
      {tab === "explore" && (
        <ExplorePane
          onOpenCard={sheet.open}
          initialRealmSlug={param("realm")}
          countryId={param("country")}
          onClearCountry={() => setParam("country", null)}
          suggesting={param("suggest") === "1"}
          onSuggestingChange={(open) => setParam("suggest", open ? "1" : null)}
        />
      )}
      <CreateAuctionModal
        key={sellOwnershipId ?? "new"}
        open={selling || sellOwnershipId !== null}
        initialOwnershipId={sellOwnershipId}
        onClose={() => {
          setSelling(false);
          if (sellOwnershipId !== null) setParam("sell", null);
        }}
      />
    </div>
  );
}
