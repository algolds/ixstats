"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/utils";
import { SearchField } from "~/components/ui/search-field";
import { ClaimableNations } from "../../_components/ClaimableNations";
import { LeaveRealmButton } from "../../_components/LeaveRealmButton";
import { MyClaims } from "../../_components/MyClaims";
import { PlayAsNation } from "../../_components/PlayAsNation";

/**
 * Every nation of the realm, the viewer's own first (with Play as and Leave realm), then the viewer's claims here
 * and the claimable pages.
 */
export default function RealmNationsPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const { data: realm, isLoading } = api.realms.getBySlug.useQuery({ slug });
  const ownsHere = !!realm?.countries.some((c) => c.mine);
  const { data: profile } = api.users.getProfile.useQuery(undefined, { enabled: ownsHere });
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
            <SearchField
              size="sm"
              value={query}
              onValueChange={setQuery}
              placeholder="Find a nation"
              aria-label="Find a nation"
              containerClassName="w-48"
            />
            <Link
              href={createUrl(`/countries?realm=${encodeURIComponent(realm.slug)}`)}
              className="text-label-secondary hover:text-label text-caption"
            >
              Open in the directory
            </Link>
          </div>
        </div>
        {countries.length === 0 ? (
          <p className="text-label-secondary text-body">No nation matches.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {countries.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={createUrl(`/countries/${c.slug ?? c.id}`)}
                  className="hover:bg-fill-3 rounded-row text-body flex min-w-0 flex-1 items-center gap-2 p-2"
                >
                  {c.flag && (
                    <img src={c.flag} alt="" className="h-4 w-6 rounded-sm object-cover" />
                  )}
                  <span className="text-label truncate">{c.name}</span>
                  {!c.claimed && (
                    <span className="text-label-secondary text-footnote ml-auto">unclaimed</span>
                  )}
                </Link>
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
        <ClaimableNations realmSlug={realm.slug} pages={realm.nationPages} />
      )}
    </div>
  );
}
