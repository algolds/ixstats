"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { assetUrl } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import { SearchField } from "~/components/ui/search-field";
import { ClaimNationButton } from "~/components/realms/ClaimNationButton";
import { ClaimableNations } from "../../_components/ClaimableNations";
import { LeaveRealmButton } from "../../_components/LeaveRealmButton";
import { MyClaims } from "../../_components/MyClaims";
import { PlayAsNation } from "../../_components/PlayAsNation";

/**
 * Every nation of the realm, the viewer's own first (with Play as and Leave realm), then the viewer's claims here
 * and the claimable pages. Unclaimed nations are badged, with Claim for signed-in viewers while claims are open.
 */
export default function RealmNationsPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const { data: realm, isLoading } = api.realms.getBySlug.useQuery({ slug });
  const { isSignedIn } = useAuth();
  // Shared with the region layout's header query: the rules a claim needs accepted.
  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  const ownsHere = !!realm?.countries.some((c) => c.mine);
  const { data: profile } = api.users.getProfile.useQuery(undefined, { enabled: ownsHere });
  const { data: myClaims } = api.realms.myClaims.useQuery(
    { realmSlug: slug },
    { enabled: !!isSignedIn }
  );
  // Nations the viewer already asked for: shown as "Pending review" instead of Claim.
  const pending = useMemo(
    () =>
      new Set(
        (myClaims ?? []).flatMap((c) => (c.status === "pending" && c.country ? [c.country.id] : []))
      ),
    [myClaims]
  );
  const [query, setQuery] = useState("");
  usePageTitle({ title: realm ? `${realm.name} · Nations` : "Nations" });

  const countries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = realm?.countries.filter((c) => !q || c.name.toLowerCase().includes(q)) ?? [];
    return [...list.filter((c) => c.mine), ...list.filter((c) => !c.mine)];
  }, [realm, query]);

  if (isLoading || !realm)
    return <p className="text-label-secondary text-body">{isLoading ? "Loading nations…" : ""}</p>;

  return (
    <div className="flex flex-col gap-6">
      <section className="border-separator bg-surface rounded-card border p-4 md:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-label text-headline">Nations · {realm.countries.length}</h2>
          <div className="flex items-center gap-3">
            {realm.countries.length > 0 && (
              <SearchField
                size="sm"
                value={query}
                onValueChange={setQuery}
                placeholder="Find a nation"
                aria-label="Find a nation"
                containerClassName="w-48"
              />
            )}
            <Link
              href={`/countries?realm=${encodeURIComponent(realm.slug)}`}
              className="text-label-secondary hover:text-label text-caption"
            >
              Open in the directory
            </Link>
          </div>
        </div>
        {countries.length === 0 ? (
          <p className="text-label-secondary text-body">
            {realm.countries.length > 0
              ? "No nation matches."
              : realm.nationPages.length > 0
                ? "No nation has been founded yet. Claim one of the nation pages below."
                : "No nation has been founded yet."}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/countries/${c.slug ?? c.id}`}
                  className="hover:bg-fill-3 rounded-row text-body flex min-w-0 flex-1 items-center gap-2 p-2"
                >
                  {c.flag && (
                    <img
                      src={assetUrl(c.flag) ?? ""}
                      alt=""
                      loading="lazy"
                      className="h-4 w-6 rounded-sm object-cover"
                    />
                  )}
                  <span
                    className={c.claimed ? "text-label truncate" : "text-label-secondary truncate"}
                  >
                    {c.name}
                  </span>
                  {!c.claimed && (
                    <Badge variant="outline" className="ml-auto">
                      Unclaimed
                    </Badge>
                  )}
                </Link>
                {!c.claimed && isSignedIn && realm.claimsOpen && pending.has(c.id) && (
                  <Badge variant="outline">Pending review</Badge>
                )}
                {!c.claimed && isSignedIn && realm.claimsOpen && !pending.has(c.id) && (
                  <ClaimNationButton realmSlug={realm.slug} countryId={c.id} countryName={c.name} />
                )}
                {c.mine && (
                  <>
                    <PlayAsNation
                      countryId={c.id}
                      countryName={c.name}
                      active={profile?.countryId === c.id}
                    />
                    <LeaveRealmButton
                      slug={realm.slug}
                      realmName={realm.name}
                      countryId={c.id}
                      countryName={c.name}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <MyClaims realmSlug={realm.slug} />

      {realm.claimsOpen && realm.nationPages.length > 0 && (
        <ClaimableNations
          realmSlug={realm.slug}
          pages={realm.nationPages}
          rules={overview?.rules ?? null}
        />
      )}
    </div>
  );
}
