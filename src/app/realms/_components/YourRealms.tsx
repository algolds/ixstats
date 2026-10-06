"use client";

import Link from "next/link";
import type { RouterOutputs } from "~/trpc/react";
import { createUrl } from "~/lib/utils";
import { assetUrl } from "~/lib/base-path";
import { PlayAsNation } from "~/app/r/[realm]/_components/PlayAsNation";
import { RealmAvatar } from "./RealmAvatar";
import { plural, realmHref, type DirectoryRealm } from "./realm-directory";

type MyRealm = RouterOutputs["realms"]["myNations"]["realms"][number];

function YourRealmCard({
  realm,
  listing,
  activeCountryId,
}: {
  realm: MyRealm;
  /** The realm's directory row (banner, thumbnail, cap); absent for a realm the directory does not list. */
  listing: DirectoryRealm | undefined;
  activeCountryId: string | null;
}) {
  const base = realm.slug ? realmHref(realm.slug) : null;
  return (
    <li className="border-separator bg-surface rounded-card flex flex-col overflow-hidden border">
      <div className="bg-fill-3 h-16 sm:h-20">
        {listing?.bannerUrl && (
          <img
            src={assetUrl(listing.bannerUrl) ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <RealmAvatar thumbnail={listing?.thumbnail} />
          <div className="min-w-0">
            {base ? (
              <Link
                href={createUrl(base)}
                className="text-label text-headline block truncate hover:underline"
              >
                {realm.name}
              </Link>
            ) : (
              <span className="text-label text-headline block truncate">{realm.name}</span>
            )}
            <p className="text-label-secondary text-footnote">
              {listing
                ? `You hold ${realm.nations.length} of ${listing.maxNationsPerUser}`
                : `You hold ${plural(realm.nations.length, "nation")}`}
            </p>
          </div>
        </div>
        <ul className="flex flex-col gap-2" aria-label={`Your nations in ${realm.name}`}>
          {realm.nations.map((nation) => (
            <li key={nation.id} className="flex flex-wrap items-center gap-2">
              <Link
                href={createUrl(`/countries/${nation.slug ?? nation.id}`)}
                className="text-label text-body flex min-w-0 flex-1 items-center gap-2 hover:underline"
              >
                {nation.flag && (
                  <img src={nation.flag} alt="" className="h-4 w-6 rounded-sm object-cover" />
                )}
                <span className="truncate">{nation.name}</span>
              </Link>
              <PlayAsNation
                countryId={nation.id}
                countryName={nation.name}
                active={activeCountryId === nation.id}
              />
            </li>
          ))}
        </ul>
        {realm.slug && (
          <div className="text-caption mt-auto flex flex-wrap items-center gap-3">
            <Link
              href={createUrl(realmHref(realm.slug, "board"))}
              className="text-label hover:underline"
            >
              Board
            </Link>
            <Link
              href={createUrl(realmHref(realm.slug, "nations"))}
              className="text-label hover:underline"
            >
              Nations
            </Link>
          </div>
        )}
      </div>
    </li>
  );
}

/** The realms where the signed-in viewer holds nations, each nation with Play as. */
export function YourRealms({
  realms,
  directory,
  activeCountryId,
}: {
  realms: MyRealm[];
  directory: DirectoryRealm[] | undefined;
  activeCountryId: string | null;
}) {
  if (realms.length === 0) return null;
  const listingById = new Map((directory ?? []).map((realm) => [realm.id, realm]));
  return (
    <section
      id="your-realms"
      aria-labelledby="your-realms-heading"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <h2 id="your-realms-heading" className="text-label text-title-3">
        Your realms · {realms.length}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {realms.map((realm) => (
          <YourRealmCard
            key={realm.id}
            realm={realm}
            listing={listingById.get(realm.id)}
            activeCountryId={activeCountryId}
          />
        ))}
      </ul>
    </section>
  );
}
