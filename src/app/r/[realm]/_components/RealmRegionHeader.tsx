"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, MapPin } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { cn, createUrl } from "~/lib/utils";
import { formatCompact } from "~/lib/format/compact";

type Overview = NonNullable<RouterOutputs["realms"]["region"]["overview"]>;

/** The tabs of a realm page. The map opens the atlas on this realm. */
function realmTabs(slug: string, canManage: boolean) {
  const base = `/r/${encodeURIComponent(slug)}`;
  return [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/board`, label: "Board" },
    { href: `${base}/nations`, label: "Nations" },
    { href: `/maps?realm=${encodeURIComponent(slug)}`, label: "Map", external: true },
    ...(canManage ? [{ href: `${base}/manage`, label: "Manage" }] : []),
  ];
}

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label-secondary text-caption">{label}</dt>
      <dd className="text-label text-headline truncate tabular-nums">{value}</dd>
    </div>
  );
}

/** The realm's banner, name, key stats and tab bar, shared by every tab. */
export function RealmRegionHeader({ overview }: { overview: Overview }) {
  const pathname = usePathname();
  const { realm, stats, founder, viewer } = overview;
  const tabs = realmTabs(realm.slug, viewer.canManage);
  const isActive = (tab: (typeof tabs)[number]) => {
    const href = createUrl(tab.href);
    return "exact" in tab && tab.exact ? pathname === href : pathname?.startsWith(href);
  };

  return (
    <header className="border-separator bg-surface rounded-card overflow-hidden border">
      <div className="bg-fill-3 relative h-32 w-full sm:h-44">
        {realm.bannerUrl ? (
          <img src={realm.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Globe className="text-label-secondary size-10" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex items-start gap-3">
          {realm.thumbnail && (
            <img
              src={realm.thumbnail}
              alt=""
              className="border-separator rounded-row -mt-12 size-16 shrink-0 border object-cover sm:-mt-14 sm:size-20"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-label text-title-1 truncate">{realm.name}</h1>
            {realm.description && (
              <p className="text-label-secondary text-body mt-1 line-clamp-2">
                {realm.description}
              </p>
            )}
            {realm.tags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Tags">
                {realm.tags.map((tag) => (
                  <li key={tag}>
                    <Badge variant="outline">{tag}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatItem label="Nations" value={stats.nations.toLocaleString()} />
          <StatItem label="Population" value={formatCompact(stats.population)} />
          <StatItem label="Founded" value={new Date(realm.foundedAt).getFullYear()} />
          <StatItem
            label="Founder"
            value={
              founder ? (
                founder.nation?.slug ? (
                  <Link
                    href={createUrl(`/countries/${founder.nation.slug}`)}
                    className="hover:underline"
                  >
                    {founder.name}
                  </Link>
                ) : (
                  founder.name
                )
              ) : (
                "IxStats staff"
              )
            }
          />
        </dl>

        {realm.status !== "active" && (
          <p className="text-label-secondary text-footnote">
            {realm.status === "archived"
              ? "This realm is archived: it can be read but no longer changes."
              : "This realm is not published yet: only its staff can see it."}
          </p>
        )}

        <nav aria-label="Realm sections" className="-mb-2 overflow-x-auto">
          <ul className="flex gap-1">
            {tabs.map((tab) => (
              <li key={tab.label}>
                <Link
                  href={createUrl(tab.href)}
                  aria-current={isActive(tab) ? "page" : undefined}
                  className={cn(
                    "rounded-control text-footnote flex items-center gap-2 px-3 py-2 font-medium whitespace-nowrap",
                    isActive(tab)
                      ? "bg-fill-3 text-label"
                      : "text-label-secondary hover:bg-fill-4 hover:text-label"
                  )}
                >
                  {"external" in tab && tab.external && (
                    <MapPin className="size-3.5" aria-hidden="true" />
                  )}
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
