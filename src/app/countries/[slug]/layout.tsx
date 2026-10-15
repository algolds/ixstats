import type { ReactNode } from "react";
import { permanentRedirect } from "next/navigation";
import { db } from "~/server/db";
import { findCountrySlugRedirect } from "~/server/shared/country-rename";

/**
 * A renamed country keeps its old address: `/countries/<old slug>` (and the maps host's root
 * `/<old slug>`, which rewrites here) redirects permanently to its current slug. A slug a country
 * holds now never redirects. A failed lookup renders the page as before rather than breaking it.
 */
export default async function CountrySlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const target = await findCountrySlugRedirect(db, slug).catch(() => null);
  if (target) permanentRedirect(`/countries/${encodeURIComponent(target)}`);
  return children;
}
