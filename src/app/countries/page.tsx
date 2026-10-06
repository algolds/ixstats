"use client";

import { useSearchParams } from "next/navigation";
import { usePageTitle } from "~/hooks/usePageTitle";
import { CountriesDirectory } from "./_components/CountriesDirectory";

/**
 * My realm: the nations of the viewer's realm (their active nation's realm, else IxWorld), or of the realm
 * named by `?realm=<slug>`. Exploring every realm happens on /realms.
 */
export default function CountriesPage() {
  // ?realm=<slug> lists that realm; without it the server uses the viewer's active nation's realm.
  const realm = useSearchParams().get("realm") ?? undefined;
  const title = realm ? "Realm nations" : "My realm";
  usePageTitle({ title });
  return <CountriesDirectory realm={realm} title={title} />;
}
