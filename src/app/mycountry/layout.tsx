import type { ReactNode } from "react";
import { HydrateClient } from "~/trpc/server";
import { MyCountryLayoutClient } from "./_components/MyCountryLayoutClient";
import { prefetchMyCountry } from "./_lib/prefetch-my-country";

/**
 * A layout persists across the sibling section pages, so the server reads the profile and country once per
 * full load; a sidebar click between sections renders only the page and does not read them again.
 */
export default async function MyCountryLayout({ children }: { children: ReactNode }) {
  await prefetchMyCountry();
  return (
    <HydrateClient>
      <MyCountryLayoutClient>{children}</MyCountryLayoutClient>
    </HydrateClient>
  );
}
