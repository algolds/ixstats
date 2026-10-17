"use client";

import { useId } from "react";
import { useSearchParams } from "next/navigation";
import { Album, Compass, MultiplePages, Shop } from "iconoir-react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { useCardHubTab } from "~/hooks/useCardHubTab";
import { useCardSheet } from "~/hooks/useCardSheet";
import {
  CARD_HUB_TABS,
  CARD_HUB_TITLES,
  marketTabOf,
  type CardHubTab,
} from "~/lib/cards/hub-routes";
import { ExplorePane } from "./ExplorePane";
import { MinePane } from "./MinePane";
import { SetsPane } from "./SetsPane";
import { MarketPane } from "./market/MarketPane";

const TAB_ICON = { mine: MultiplePages, sets: Album, market: Shop, explore: Compass } as const;
const TABS = CARD_HUB_TABS.map((value) => {
  const Icon = TAB_ICON[value];
  return { value, label: CARD_HUB_TITLES[value], icon: <Icon /> };
});

/** Rewrites one query parameter of the hub's address, keeping its fragment; `push` makes a step Back undoes. */
function setParam(key: string, value: string | null, push = false) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  const search = url.searchParams.toString();
  const next = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  if (push) window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

/** The cards hub: Mine, Sets, Market and Explore, each at its own address. */
export function CardsHub({ initialTab }: { initialTab: CardHubTab }) {
  const { tab, navigate } = useCardHubTab(initialTab);
  const sheet = useCardSheet();
  const params = useSearchParams();
  const param = (key: string) => params?.get(key) || null;
  const panelId = useId();

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Cards</h1>
      <SegmentedControl
        asTabs
        fullWidth
        aria-label="Cards"
        value={tab}
        onValueChange={navigate}
        getTabPanelId={() => panelId}
        options={TABS}
        className="w-full sm:max-w-lg"
      />
      <div role="tabpanel" id={panelId} aria-label={CARD_HUB_TITLES[tab]}>
        {tab === "mine" && <MinePane onOpenCard={sheet.open} />}
        {tab === "sets" && (
          <SetsPane
            onOpenCard={sheet.open}
            showcaseId={param("showcase")}
            onShowcaseChange={(id) => setParam("showcase", id, id !== null)}
          />
        )}
        {tab === "market" && (
          <MarketPane
            tab={marketTabOf(param("tab"))}
            onTabChange={(next) => setParam("tab", next === "browse" ? null : next)}
            forCardId={param("for")}
            onClearFor={() => setParam("for", null)}
            sellOwnershipId={param("sell")}
            onSellHandled={() => setParam("sell", null)}
            onOpenCard={sheet.open}
          />
        )}
        {tab === "explore" && (
          <ExplorePane
            onOpenCard={sheet.open}
            initialRealmSlug={param("realm")}
            suggesting={param("suggest") === "1"}
            onSuggestingChange={(open) => setParam("suggest", open ? "1" : null)}
          />
        )}
      </div>
    </div>
  );
}
