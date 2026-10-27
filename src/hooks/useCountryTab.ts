"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import { countryTabHref, countryTabOf, type CountryTab } from "~/lib/country/country-routes";

/**
 * The country document's tab router (the single-page pattern, as `useCardHubTab`): switches tabs
 * in place with pushState, follows back and forward, and re-syncs when a <Link> changes the path
 * under the mounted page. The address wins over the page's own tab from the first render: a Back
 * across a soft navigation can restore one tab's page at another tab's address.
 */
export function useCountryTab(
  initialTab: CountryTab,
  slug: string
): { tab: CountryTab; navigate: (tab: CountryTab) => void } {
  const pathname = usePathname();
  const addressTab = pathname ? countryTabOf(pathname) : null;
  const [tab, setTab] = useState<CountryTab>(addressTab ?? initialTab);

  useEffect(() => {
    // oxlint-disable-next-line
    if (addressTab) setTab(addressTab);
  }, [addressTab]);

  useEffect(() => {
    const onPopState = () => setTab(countryTabOf(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: CountryTab) => {
      if (next === tab) return;
      setTab(next);
      window.history.pushState(null, "", withBasePath(countryTabHref(next, slug)));
    },
    [slug, tab]
  );

  return { tab, navigate };
}
