"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Album, Compass, MultiplePages, Plus, Shop } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { useCardHubTab } from "~/hooks/useCardHubTab";
import { useCardSheet } from "~/hooks/useCardSheet";
import {
  CARD_HUB_TABS,
  CARD_HUB_TITLES,
  marketTabOf,
  tradeBuilderHref,
  type CardHubTab,
  type MarketTab,
} from "~/lib/cards/hub-routes";
import { addressWith } from "~/lib/utils/address";
import { ExplorePane } from "./ExplorePane";
import { MinePane } from "./MinePane";
import { NewShowcaseAction, SetsPane } from "./SetsPane";
import { MarketPane } from "./market/MarketPane";

const TAB_ICON = { mine: MultiplePages, sets: Album, market: Shop, explore: Compass } as const;
const TABS = CARD_HUB_TABS.map((value) => {
  const Icon = TAB_ICON[value];
  return { value, label: CARD_HUB_TITLES[value], icon: <Icon /> };
});

/** Rewrites one query parameter of the hub's address, keeping its fragment; `push` makes a step Back undoes. */
function setParam(key: string, value: string | null, push = false) {
  const next = addressWith(window.location.href, (query) => {
    if (value) query.set(key, value);
    else query.delete(key);
  });
  if (push) window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

/** One primary action per surface, placed in the hub's PageHeader. */
function hubHeaderAction(args: {
  tab: CardHubTab;
  marketTab: MarketTab;
  showcaseId: string | null;
  onSell: () => void;
  onShowcaseSaved: (id: string) => void;
  onSuggest: () => void;
}): ReactNode {
  if (args.tab === "market") {
    if (args.marketTab === "trades") {
      return (
        <Button size="sm" asChild>
          <Link href={tradeBuilderHref({})}>
            <Plus aria-hidden />
            New trade
          </Link>
        </Button>
      );
    }
    if (args.marketTab === "browse" || args.marketTab === "selling") {
      return (
        <Button size="sm" onClick={args.onSell}>
          <Plus aria-hidden />
          Sell a card
        </Button>
      );
    }
    return undefined;
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

/** The cards hub: Mine, Sets, Market and Explore, each at its own address. */
export function CardsHub({ initialTab }: { initialTab: CardHubTab }) {
  const { tab, navigate } = useCardHubTab(initialTab);
  const sheet = useCardSheet();
  const params = useSearchParams();
  const param = (key: string) => params?.get(key) || null;
  const panelId = useId();
  const [selling, setSelling] = useState(false);

  const marketTab = marketTabOf(param("tab"));
  const showcaseId = param("showcase");
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cards"
        back={{ href: "/vault", label: "Vault" }}
        bleed
        actions={hubHeaderAction({
          tab,
          marketTab,
          showcaseId,
          onSell: () => setSelling(true),
          onShowcaseSaved: (id) => setParam("showcase", id, true),
          onSuggest: () => setParam("suggest", "1"),
        })}
      />
      <SegmentedControl
        asTabs
        // Each tab is its own address: an arrow key moves focus only, so passing a tab never pushes a history entry.
        activationMode="manual"
        // No tab narrower than its label: below 24rem (a 320px phone) the icons go so the four labels fit, and a
        // larger text size that still overflows scrolls the track rather than the page.
        scrollable
        itemClassName="min-w-max max-[24rem]:[&_svg]:hidden"
        aria-label="Cards"
        value={tab}
        onValueChange={navigate}
        getTabPanelId={() => panelId}
        options={TABS}
        className="max-w-full"
      />
      <div role="tabpanel" id={panelId} aria-label={CARD_HUB_TITLES[tab]}>
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
            sellOwnershipId={param("sell")}
            onSellHandled={() => setParam("sell", null)}
            selling={selling}
            onSellOpen={() => setSelling(true)}
            onSellClose={() => setSelling(false)}
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
      </div>
    </div>
  );
}
