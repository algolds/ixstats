"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/utils";
import { legacyHashRoute } from "~/lib/country/factbook-routes";
import { CommandProfileView } from "../_components/CommandProfileView";
import { useProfileShell } from "../_components/ProfileShellContext";

/**
 * CountryProfilePage: `/countries/[slug]` (route group `(profile)`), the Factbook tab's overview:
 * the hero and key facts, then the domain stream, on the profile layer. The other Factbook
 * sections (`/factbook/<section>`), the Dossier and Activity are the deep-dives; `/factbook`
 * itself redirects here.
 *
 * Deep links that used the legacy URL hash (`/countries/:slug#economy`, `#dossier`,
 * `#activity`, …) still move to the equivalent route; any other hash (including `#overview`)
 * stays here. `/countries/[slug]/modeling` lives outside this route group and is unaffected.
 */
export default function CountryProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const shell = useProfileShell();

  useEffect(() => {
    const route = legacyHashRoute(window.location.hash);
    if (route) router.replace(createUrl(`/countries/${slug}${route}`));
  }, [router, slug]);

  return (
    <CommandProfileView
      slug={shell.slug}
      country={shell.country}
      flagUrl={shell.flagUrl}
      isOwner={shell.isOwner}
      currentIxTime={shell.currentIxTime}
      cover={shell.cover}
    />
  );
}
