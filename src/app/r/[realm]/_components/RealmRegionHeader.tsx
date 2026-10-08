"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, MapPin } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { ShareSheet } from "~/components/share/ShareSheet";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { formatCompact } from "~/lib/format/compact";
import { assetUrl } from "~/lib/base-path";

type Overview = NonNullable<RouterOutputs["realms"]["region"]["overview"]>;

/**
 * The tabs of a realm page. The map opens the atlas on this realm; Rules shows once the realm has rules (and
 * always to those who can write them).
 */
function realmTabs(slug: string, canManage: boolean, showRules: boolean) {
  const base = `/r/${encodeURIComponent(slug)}`;
  return [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/board`, label: "Board" },
    { href: `${base}/nations`, label: "Nations" },
    ...(showRules ? [{ href: `${base}/rules`, label: "Rules" }] : []),
    { href: `/maps?realm=${encodeURIComponent(slug)}`, label: "Map", external: true },
    ...(canManage ? [{ href: `${base}/manage`, label: "Manage" }] : []),
  ];
}

function StatItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-label-secondary text-caption">{label}</dt>
      <dd className="text-label text-headline truncate tabular-nums">{value}</dd>
      {hint && <dd className="text-label-secondary text-caption truncate">{hint}</dd>}
    </div>
  );
}

/** A fixed in-world date's "as of" real date (YYYY-MM-DD), read as a calendar day. */
const asOfHint = (asOf: string | null | undefined) =>
  asOf
    ? `as of ${new Date(`${asOf}T00:00:00Z`).toLocaleDateString(undefined, {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    : undefined;

/** The founder's passport when they have a handle, else their nation here. `<Link>` adds the base path. */
function founderHref(founder: NonNullable<Overview["founder"]>) {
  if (founder.handle) return `/@${encodeURIComponent(founder.handle)}`;
  return founder.nation?.slug ? `/countries/${founder.nation.slug}` : null;
}

/** Share, plus "Copy invite link" (carrying the viewer's passport handle) for those who hold a nation here. */
function RealmShare({
  slug,
  name,
  holdsNation,
}: {
  slug: string;
  name: string;
  holdsNation: boolean;
}) {
  const { data: status } = api.ixnayid.getStatus.useQuery(undefined, { enabled: holdsNation });
  const handle = holdsNation ? status?.passportHandle : null;
  const base = `/r/${encodeURIComponent(slug)}`;
  return (
    <ShareSheet
      path={base}
      title={`${name} on IxStates`}
      imagePath={`${base}/opengraph-image`}
      downloadName={`ixstates-realm-${slug}.png`}
      extraLinks={
        handle
          ? [{ label: "Copy invite link", path: `${base}?via=${encodeURIComponent(handle)}` }]
          : []
      }
    />
  );
}

/** The realm's banner, name, key stats and tab bar, shared by every tab. */
export function RealmRegionHeader({
  overview,
  openToClaim,
}: {
  overview: Overview;
  /** Nation pages and unclaimed nations a player can still take; 0 while claims are closed. */
  openToClaim: number;
}) {
  const pathname = usePathname();
  const { realm, stats, founder, viewer, inWorldDate } = overview;
  const founderLink = founder ? founderHref(founder) : null;
  const tabs = realmTabs(
    realm.slug,
    viewer.canManage,
    !!overview.rules || viewer.powers.includes("appearance")
  );
  const isActive = (tab: (typeof tabs)[number]) => {
    const href = tab.href;
    return "exact" in tab && tab.exact ? pathname === href : pathname?.startsWith(href);
  };

  return (
    <header className="border-separator bg-surface rounded-card overflow-hidden border">
      <div className="bg-tint-fill relative h-32 w-full sm:h-44">
        {realm.bannerUrl ? (
          <img
            src={assetUrl(realm.bannerUrl) ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Globe className="text-tint size-10" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex items-start gap-3">
          {realm.thumbnail && (
            <img
              src={assetUrl(realm.thumbnail) ?? ""}
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
          <RealmShare
            slug={realm.slug}
            name={realm.name}
            holdsNation={viewer.signedIn && viewer.ownedNations.length > 0}
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap">
          <StatItem
            label="Nations"
            value={stats.nations.toLocaleString()}
            hint={stats.nations > 0 ? `${stats.claimedNations.toLocaleString()} played` : undefined}
          />
          {openToClaim > 0 && (
            <StatItem label="Open to claim" value={openToClaim.toLocaleString()} />
          )}
          {stats.population > 0 && (
            <StatItem label="Population" value={formatCompact(stats.population)} />
          )}
          <StatItem label="Founded" value={new Date(realm.foundedAt).getFullYear()} />
          <StatItem
            label="Founder"
            value={
              founder ? (
                founderLink ? (
                  <Link href={founderLink} className="hover:underline">
                    {founder.name}
                  </Link>
                ) : (
                  founder.name
                )
              ) : (
                "Administered by IxStats staff"
              )
            }
          />
          {inWorldDate && (
            <StatItem
              label="In-world date"
              value={inWorldDate.label}
              hint={asOfHint(inWorldDate.asOf)}
            />
          )}
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
                  href={tab.href}
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
