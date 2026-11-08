"use client";

import { LensSurface } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { BuilderPane } from "./BuilderPane";
import { FrontPageFeed } from "./FrontPageFeed";
import { FrontPageHero } from "./FrontPageHero";
import { WikiPane } from "./WikiPane";

/**
 * The signed-out front page on the cohesive iron-gall ink canvas:
 * - Dashboard-style split hero card featuring Eurth (live map, realm identity,
 *   lore description, 3-cell telemetry, and 2×2 leading powers grid)
 * - Asymmetric 2-column layout:
 *   - 8-col main stage: rolling Unified Activity Stream
 *   - 4-col sticky discovery rail: MyCountry Builder kickstarter and Wiki (on phones the
 *     Builder moves above the feed)
 */
export function FrontPage() {
  const query = api.frontPage.get.useQuery();
  const data = query.data;
  const realm = data?.featured ?? undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-(--shell-top-offset) pb-12 md:px-6">
      <FrontPageHero
        realm={realm}
        nations={data?.nations ?? []}
        facts={data?.facts}
        isLoading={query.isLoading}
      />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        {/* On phones the rail falls below a long feed, so the one sign-up action comes first. */}
        <div className="lg:hidden">
          <BuilderPane />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
          <LensSurface>
            <FrontPageFeed />
          </LensSurface>
        </div>

        {/* Pinned under the top bar; a rail taller than the window scrolls inside itself, so it is
            never cut off and never sits low on a tall window. */}
        <aside
          aria-label="World discovery and activity"
          className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-(--shell-top-offset) lg:col-span-4 lg:max-h-[calc(100dvh-var(--shell-top-offset)-1.25rem)] lg:[scrollbar-width:thin] lg:overflow-y-auto lg:overscroll-contain"
        >
          <div className="hidden lg:contents">
            <BuilderPane />
          </div>
          <LensSurface>
            <WikiPane />
          </LensSurface>
        </aside>
      </div>
    </div>
  );
}
