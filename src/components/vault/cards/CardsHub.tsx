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
import { addressWith } from "~/lib/utils/address";
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
  const next = addressWith(window.location.href, (query) => {
    if (value) query.set(key, value);
    else query.delete(key);
  });
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
    // pt-14: the tabs are the first row and the hub has no header toolbar, so it clears Halo's floating band itself.
    <div className="space-y-4 pt-14">
      <h1 className="sr-only">Cards</h1>
      <SegmentedControl
        asTabs
        // Each tab is its own address: an arrow key moves focus only, so passing a tab never pushes a history entry.
        activationMode="manual"
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
