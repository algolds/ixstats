"use client";

import { usePathname } from "next/navigation";
import { EmptyState } from "~/components/ui/empty-state";
import { exchangeRouteOf, type ExchangeRoute } from "~/lib/exchange/routes";

/** The page for one Exchange address. Each section and object page fills in its own component. */
function ExchangePage({ route }: { route: ExchangeRoute }) {
  if (route.kind === "unknown") {
    return <EmptyState title="Nothing here" message="This Exchange address doesn't exist." />;
  }
  return <EmptyState title="Coming up" message="This part of the Exchange is being built." />;
}

/**
 * The Exchange's one router (single-page pattern, as MyCountry and the cards hub): the page comes from the path,
 * so a sidebar click or the back button changes it without a route transition.
 */
export function ExchangeRouter() {
  const route = exchangeRouteOf(usePathname());
  return <ExchangePage route={route} />;
}
