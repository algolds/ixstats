"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/utils";
import { hashToFactbookRoute } from "~/lib/wiki-os/adapters/ixstates/factbook-routes";

/**
 * PublicCountryPage — `/countries/[slug]` (route group `(profile)`).
 *
 * With the country profile flattened onto real nested routes, this page is now
 * a thin redirect. It preserves deep links that used the legacy URL hash
 * (`/countries/:slug#economy`, `#dossier`, `#activity`, ...) by mapping the
 * hash onto the equivalent route, and otherwise lands on
 * `/countries/:slug/factbook`.
 *
 * `/countries/[slug]/modeling` lives outside this route group and is unaffected.
 */

export default function PublicCountryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  useEffect(() => {
    const route = hashToFactbookRoute(window.location.hash);
    router.replace(createUrl(`/countries/${slug}${route}`));
  }, [router, slug]);

  return null;
}
