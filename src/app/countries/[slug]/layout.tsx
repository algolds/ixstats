import type { ReactNode } from "react";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { db } from "~/server/db";
import { findCountrySlugRedirect } from "~/server/shared/country-rename";
import { countrySlugRedirectPath, REQUEST_PATH_HEADER } from "~/lib/countries/slug-redirect";

/**
 * A renamed country keeps its old addresses: `/countries/<old slug>/…?…` (and the maps host's
 * root `/<old slug>`, which rewrites here) redirects permanently to the same page and query under
 * its current slug. A slug a country holds now never redirects. A failed lookup renders the page
 * as before rather than breaking it.
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
  if (target) {
    const requestPath = (await headers()).get(REQUEST_PATH_HEADER);
    permanentRedirect(countrySlugRedirectPath(requestPath, slug, target));
  }
  return children;
}
