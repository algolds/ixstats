"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, OpenBook } from "iconoir-react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { createUrl } from "~/lib/utils";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { ClaimableNations } from "./_components/ClaimableNations";
import { PlayAsNation } from "./_components/PlayAsNation";

/** The realm's lore lives on its wiki (ruling E-a); WikiOS renders the portal live from that wiki. */
function LoreSection({
  realmName,
  count,
  source,
}: {
  realmName: string;
  count: number;
  source: string;
}) {
  const portal = `Portal:${realmName}`;
  return (
    <section className="border-border bg-card/70 rounded-2xl border p-6">
      <h2 className="text-foreground mb-3 text-sm font-bold">
        Lore · {count.toLocaleString()} pages
      </h2>
      <Link
        href={createUrl(wikiReaderPath(portal, parseWikiSource(source)))}
        className="hover:bg-muted text-foreground inline-flex items-center gap-2 rounded-xl p-2 text-sm"
      >
        <OpenBook className="h-4 w-4" />
        Read {portal} in WikiOS
      </Link>
    </section>
  );
}

export default function RealmPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const { data: realm, isLoading } = api.realms.getBySlug.useQuery({ slug });
  const ownsHere = !!realm?.countries.some((c) => c.mine);
  const { data: profile } = api.users.getProfile.useQuery(undefined, { enabled: ownsHere });
  usePageTitle({ title: realm ? `${realm.name} · Realm` : "Realm" });

  if (isLoading)
    return (
      <div className="text-muted-foreground mx-auto max-w-5xl p-8 text-sm">Loading realm…</div>
    );
  if (!realm) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="border-border bg-card/70 flex items-center gap-4 rounded-2xl border p-6 backdrop-blur-xl">
        <div className="border-border bg-accent flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
          {realm.thumbnail ? (
            <img src={realm.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <Globe className="h-7 w-7" />
          )}
        </div>
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{realm.name}</h1>
          {realm.description && (
            <p className="text-muted-foreground mt-1 text-sm">{realm.description}</p>
          )}
        </div>
      </header>

      <section className="border-border bg-card/70 rounded-2xl border p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-foreground text-sm font-bold">Nations · {realm.countries.length}</h2>
          <div className="flex items-center gap-3">
            <Link
              href={createUrl(`/r/${encodeURIComponent(realm.slug)}/board`)}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Realm board
            </Link>
            <Link
              href={createUrl(`/maps?realm=${encodeURIComponent(realm.slug)}`)}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              View map
            </Link>
            <Link
              href={createUrl(`/countries?realm=${encodeURIComponent(realm.slug)}`)}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              View all in the directory
            </Link>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {realm.countries.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <Link
                href={createUrl(`/countries/${c.slug ?? c.id}`)}
                className="hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-xl p-2 text-sm"
              >
                {c.flag && <img src={c.flag} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                <span className="text-foreground truncate">{c.name}</span>
                {!c.claimed && (
                  <span className="text-muted-foreground ml-auto text-xs">unclaimed</span>
                )}
              </Link>
              {c.mine && (
                <PlayAsNation
                  countryId={c.id}
                  countryName={c.name}
                  active={profile?.countryId === c.id}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {realm.nationPages.length > 0 && (
        <ClaimableNations realmSlug={realm.slug} pages={realm.nationPages} />
      )}

      {realm.lorePageCount > 0 && realm.loreSource && (
        <LoreSection realmName={realm.name} count={realm.lorePageCount} source={realm.loreSource} />
      )}
    </div>
  );
}
