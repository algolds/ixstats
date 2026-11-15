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
/**
 * Publishes the rail's height as --rail-h, so a rail taller than the screen sticks by its bottom
 * edge instead of hiding it (see the aside's `top`).
 */
function trackRailHeight(el: HTMLElement | null) {
  if (!el) return;
  const observer = new ResizeObserver(() =>
    el.style.setProperty("--rail-h", `${el.offsetHeight}px`)
  );
  observer.observe(el);
  return () => observer.disconnect();
}

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

      <LensSurface>
        <div className="grid items-start gap-5 lg:grid-cols-12">
          {/* On phones the rail falls below a long feed, so the one sign-up action comes first. */}
          <div className="lg:hidden">
            <BuilderPane />
          </div>

          <div className="facet-lens-flat flex min-w-0 flex-col gap-5 lg:col-span-8">
            <FrontPageFeed />
          </div>

          <aside
            ref={trackRailHeight}
            aria-label="World discovery and activity"
            className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[min(var(--shell-top-offset),calc(100dvh-var(--rail-h,0px)-1.25rem))] lg:col-span-4"
          >
            <div className="hidden lg:contents">
              <BuilderPane />
            </div>
            <WikiPane />
          </aside>
        </div>
      </LensSurface>
    </div>
  );
}
