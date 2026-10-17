"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import {
  CARD_HUB_PATHS,
  CARD_HUB_TITLES,
  cardHubTabOf,
  type CardHubTab,
} from "~/lib/cards/hub-routes";

/**
 * The cards hub's tab router (the single-page pattern): switches tabs in place with pushState, follows back and
 * forward, and re-syncs when a sidebar <Link> changes the path under the mounted hub. An address outside the four
 * tabs keeps the tab on screen, since the hub is leaving. The address wins over the page's own tab from the first
 * render: a Back across a soft navigation can restore one tab's page at another tab's address.
 */
export function useCardHubTab(initialTab: CardHubTab): {
  tab: CardHubTab;
  navigate: (tab: CardHubTab) => void;
} {
  const pathname = usePathname();
  const addressTab = pathname ? cardHubTabOf(pathname) : null;
  const [tab, setTab] = useState<CardHubTab>(addressTab ?? initialTab);

  useEffect(() => {
    if (addressTab) setTab(addressTab);
  }, [addressTab]);

  useEffect(() => {
    const onPopState = () => {
      const fromPath = cardHubTabOf(window.location.pathname);
      if (fromPath) setTab(fromPath);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Back, Forward and a re-sync change the tab without a new page, so its <title> stays put unless set here.
  useEffect(() => {
    document.title = `${CARD_HUB_TITLES[tab]} · Cards - IxStates`;
  }, [tab]);

  const navigate = useCallback(
    (next: CardHubTab) => {
      if (next === tab) return;
      setTab(next);
      window.history.pushState(null, "", withBasePath(CARD_HUB_PATHS[next]));
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [tab]
  );

  return { tab, navigate };
}
