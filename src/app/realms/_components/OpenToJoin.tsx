"use client";

import Link from "next/link";
import { createUrl } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { RealmAvatar } from "./RealmAvatar";
import { openToJoinCount, plural, realmHref, type DirectoryRealm } from "./realm-directory";

/** Realms with nations waiting for a player, most open first. Empty when none is. */
export function openRealms(realms: DirectoryRealm[] | undefined): DirectoryRealm[] {
  return (realms ?? [])
    .filter((realm) => openToJoinCount(realm) > 0)
    .sort((a, b) => openToJoinCount(b) - openToJoinCount(a) || a.name.localeCompare(b.name));
}

function openDetail(realm: DirectoryRealm): string {
  const parts = [];
  if (realm.openNationCount > 0) parts.push(plural(realm.openNationCount, "unclaimed nation"));
  if (realm.openNationPageCount > 0)
    parts.push(`${plural(realm.openNationPageCount, "nation page")} to claim`);
  return parts.join(" · ");
}

/** Where a newcomer can play: each realm's unclaimed nations and claimable nation pages, linked to its Nations tab. */
export function OpenToJoin({ realms }: { realms: DirectoryRealm[] }) {
  if (realms.length === 0) return null;
  return (
    <section
      id="open-to-join"
      aria-labelledby="open-to-join-heading"
      className="border-separator bg-surface rounded-card scroll-mt-4 border p-4 md:p-6"
    >
      <h2 id="open-to-join-heading" className="text-label text-title-3">
        Open to join
      </h2>
      <p className="text-label-secondary text-footnote mt-1 mb-4">
        Realms with nations waiting for a player. Claim an unclaimed nation, or the nation whose
        wiki page you wrote.
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {realms.map((realm) => {
          const atCap = realm.myNationCount >= realm.maxNationsPerUser;
          return (
            <li
              key={realm.id}
              className="border-separator rounded-row flex items-center gap-3 border p-3"
            >
              <RealmAvatar thumbnail={realm.thumbnail} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={createUrl(realmHref(realm.slug))}
                    className="text-label text-body truncate font-medium hover:underline"
                  >
                    {realm.name}
                  </Link>
                  <Badge variant="success">{openToJoinCount(realm).toLocaleString()} open</Badge>
                </div>
                <p className="text-label-secondary text-footnote truncate">
                  {atCap ? "You hold the most nations allowed here" : openDetail(realm)}
                </p>
              </div>
              <Link
                href={createUrl(realmHref(realm.slug, "nations"))}
                className="text-tint text-footnote shrink-0 underline-offset-4 hover:underline"
                aria-label={`See the nations of ${realm.name}`}
              >
                See nations
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
