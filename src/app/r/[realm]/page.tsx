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
import { PageHeader } from "~/components/shell/PageHeader";

/** The realm's lore lives on its wiki; WikiOS renders the portal live from that wiki. */
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
    <section className="border-separator bg-surface rounded-card border p-6">
      <h2 className="text-label text-headline mb-3">Lore · {count.toLocaleString()} pages</h2>
      <Link
        href={createUrl(wikiReaderPath(portal, parseWikiSource(source)))}
        className="hover:bg-fill-3 text-label rounded-row text-body inline-flex items-center gap-2 p-2"
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
      <div className="text-label-secondary text-body mx-auto max-w-5xl p-8">Loading realm…</div>
    );
  if (!realm) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title={realm.name}
        subtitle={realm.description}
        leading={
          <div className="border-separator bg-fill-3 rounded-card flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border">
            {realm.thumbnail ? (
              <img src={realm.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <Globe className="h-7 w-7" />
            )}
          </div>
        }
      />

      <section className="border-separator bg-surface rounded-card border p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-label text-headline">Nations · {realm.countries.length}</h2>
          <div className="flex items-center gap-3">
            <Link
              href={createUrl(`/r/${encodeURIComponent(realm.slug)}/board`)}
              className="text-label-secondary hover:text-label text-caption"
            >
              Realm board
            </Link>
            <Link
              href={createUrl(`/maps?realm=${encodeURIComponent(realm.slug)}`)}
              className="text-label-secondary hover:text-label text-caption"
            >
              View map
            </Link>
            <Link
              href={createUrl(`/countries?realm=${encodeURIComponent(realm.slug)}`)}
              className="text-label-secondary hover:text-label text-caption"
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
                className="hover:bg-fill-3 rounded-row text-body flex min-w-0 flex-1 items-center gap-2 p-2"
              >
                {c.flag && <img src={c.flag} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                <span className="text-label truncate">{c.name}</span>
                {!c.claimed && (
                  <span className="text-label-secondary text-footnote ml-auto">unclaimed</span>
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
