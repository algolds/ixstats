"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Activity, OpenBook, Page } from "iconoir-react";
import { springSnappy } from "~/lib/design/motion";
import { cn } from "~/lib/utils/cn";
import type { ProfileTabType } from "../_types";

/**
 * The country's top-level tabs. The Factbook is the country's own URL: it opens on the overview
 * (hero, key facts and the domain stream) and its other sections live under `/factbook/*`.
 */
export const COUNTRY_TABS: {
  id: ProfileTabType;
  label: string;
  path: string;
  icon: typeof Page;
}[] = [
  { id: "factbook", label: "Factbook", path: "", icon: Page },
  { id: "dossier", label: "Dossier", path: "/dossier", icon: OpenBook },
  { id: "activity", label: "Activity", path: "/activity", icon: Activity },
];

/**
 * The tab a pathname under `/countries/[slug]` belongs to. The country's own URL and every
 * `/factbook/*` section are the Factbook, as is anything unrecognised.
 */
export function activeCountryTab(pathname: string | null, slug: string): ProfileTabType {
  const base = `/countries/${slug}`;
  const index = pathname?.indexOf(base) ?? -1;
  const rest = index >= 0 ? pathname!.slice(index + base.length).replace(/^\/+/, "") : "";
  const first = rest.split(/[/?#]/)[0];
  return COUNTRY_TABS.find((t) => t.path !== "" && t.path === `/${first}`)?.id ?? "factbook";
}

/**
 * CountryTabs: Tier 1 navigation for a country: the Factbook (the country's own URL) and the
 * Dossier and Activity deep-dives. Real links styled as a Facet segmented control: a `fill-3`
 * track and an opaque thumb that springs (`springSnappy`) to the current route.
 */
export function CountryTabs({
  countrySlug,
  className,
}: {
  countrySlug: string;
  className?: string;
}) {
  const pathname = usePathname();
  const active = activeCountryTab(pathname, countrySlug);

  return (
    <nav aria-label="Country sections" className={cn("w-full min-w-0", className)}>
      <ul className="bg-fill-3 rounded-control flex w-full gap-0.5 overflow-x-auto p-0.5">
        {COUNTRY_TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="min-w-fit flex-1">
              <Link
                href={`/countries/${countrySlug}${tab.path}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "text-body rounded-control-sm focus-visible:outline-tint duration-fast ease-out-facet relative flex h-(--control-height) items-center justify-center gap-2 px-3 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                  isActive ? "text-label" : "text-label-secondary hover:text-label"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="country-tab-thumb"
                    aria-hidden
                    transition={springSnappy}
                    className="bg-surface rounded-control-sm shadow-card absolute inset-0"
                  />
                )}
                <Icon aria-hidden className="relative size-4 shrink-0" />
                <span className="relative">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
