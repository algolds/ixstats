"use client";

import Link from "next/link";
import type { RouterOutputs } from "~/trpc/react";
import { realmBoardHref } from "~/lib/thinkpages-forum/links";
import { PlayAsNation } from "~/app/r/[realm]/_components/PlayAsNation";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import { Card } from "~/components/ui/card";
import { plural, realmBadge, realmHref, type DirectoryRealm } from "./realm-directory";

type MyRealm = RouterOutputs["realms"]["myNations"]["realms"][number];

function YourRealmRow({
  realm,
  listing,
  activeCountryId,
}: {
  realm: MyRealm;
  /** The realm's directory row (thumbnail, cap); absent for a realm the directory does not list. */
  listing: DirectoryRealm | undefined;
  activeCountryId: string | null;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <RealmCrest
          size="md"
          realm={realmBadge({
            id: realm.id,
            slug: realm.slug ?? realm.id,
            name: realm.name,
            thumbnail: listing?.thumbnail ?? null,
          })}
        />
        <div className="min-w-0">
          {realm.slug ? (
            <Link
              href={realmHref(realm.slug)}
              className="text-label text-headline block truncate hover:underline"
            >
              {realm.name}
            </Link>
          ) : (
            <span className="text-label text-headline block truncate">{realm.name}</span>
          )}
          <p className="text-label-secondary text-footnote">
            {listing
              ? `${realm.nations.length} of ${listing.maxNationsPerUser}`
              : plural(realm.nations.length, "nation")}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-2" aria-label={`Your nations in ${realm.name}`}>
        {realm.nations.map((nation) => (
          <li key={nation.id} className="flex flex-wrap items-center gap-2">
            <Link
              href={`/countries/${nation.slug ?? nation.id}`}
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
        <div className="text-caption flex flex-wrap items-center gap-3">
          {/* The live board, whose rail lists the realm's boards. */}
          <Link
            href={realmBoardHref(realm.slug)}
            className="text-label hover:underline pointer-coarse:min-h-11"
          >
            Board
          </Link>
          <Link href={realmHref(realm.slug, "nations")} className="text-label hover:underline">
            Nations
          </Link>
        </div>
      )}
    </li>
  );
}

/** The realms where the signed-in viewer holds nations, each nation with Play as: the rail's compact list. */
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
    <Card
      id="your-realms"
      content="entity"
      padding="md"
      aria-labelledby="your-realms-heading"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <h2 id="your-realms-heading" className="text-label text-headline">
        Your realms
      </h2>
      <ul className="flex flex-col gap-4">
        {realms.map((realm) => (
          <YourRealmRow
            key={realm.id}
            realm={realm}
            listing={listingById.get(realm.id)}
            activeCountryId={activeCountryId}
          />
        ))}
      </ul>
    </Card>
  );
}
