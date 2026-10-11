"use client";

import Link from "next/link";
import { RealmAvatar } from "~/components/realms/RealmAvatar";
import { plural, realmHref } from "~/app/realms/_components/realm-directory";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { assetUrl } from "~/lib/base-path";
import { withVia } from "~/lib/realms/realm-invite";
import { realmHref as boardHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";
import { useInviteVia } from "./use-invite-via";

/** What `realms.region.overview` returns for a realm the viewer may see: the card is live, never a stored snapshot. */
export type AdvertOverview = NonNullable<RouterOutputs["realms"]["region"]["overview"]>;

const TOUCH = "pointer-coarse:min-h-11";

/**
 * The way in: Join opens the realm's own page (where the claim flow runs and an invite's `?via=` is honoured), unless
 * the viewer already holds a nation there or the realm takes no new nations.
 */
function AdvertActions({ overview }: { overview: AdvertOverview }) {
  const via = useInviteVia();
  const { realm, rules, viewer } = overview;
  const status =
    viewer.ownedNations.length > 0 ? (
      <span className="text-label-secondary text-footnote">You are in this realm</span>
    ) : realm.claimsOpen ? (
      <Link
        href={withVia(realmHref(realm.slug), via)}
        className={cn(buttonVariants({ size: "sm" }), TOUCH)}
      >
        Join
      </Link>
    ) : (
      <span className="text-label-secondary text-footnote">Closed to new nations</span>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      {status}
      <Link
        href={boardHref(realm.slug)}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), TOUCH)}
      >
        Visit the board
      </Link>
      {rules && (
        <Link
          href={realmHref(realm.slug, "rules")}
          className={cn("text-tint text-footnote inline-flex items-center hover:underline", TOUCH)}
        >
          Rules
        </Link>
      )}
    </div>
  );
}

function AdvertTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge variant="outline">{tag}</Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * A Find a Realm advert's head: the realm's banner, emblem, counts, tags, a way in, the board and the rules. It reads
 * only the realm's public overview, never the viewer's own nations or powers beyond "already in", and it does not
 * join the board's presence room, so it carries no online figure.
 */
export function RealmAdvertCard({ overview }: { overview: AdvertOverview }) {
  const { realm, stats } = overview;
  return (
    <Card
      content="entity"
      role="region"
      aria-label={`${realm.name} advert`}
      className="overflow-hidden"
    >
      {realm.bannerUrl && (
        <div className="bg-fill-3 h-32 sm:h-40">
          <img
            src={assetUrl(realm.bannerUrl) ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <RealmAvatar thumbnail={realm.emblemUrl || realm.thumbnail} className="size-14" />
          <div className="min-w-0">
            <Link
              href={realmHref(realm.slug)}
              className="text-label text-title-3 block truncate hover:underline"
            >
              {realm.name}
            </Link>
            <p className="text-label-secondary text-footnote tabular-nums">
              {plural(stats.claimedNations, "member")} · {plural(stats.nations, "nation")}
            </p>
          </div>
        </div>
        {realm.description && <p className="text-label-secondary text-body">{realm.description}</p>}
        <AdvertTags tags={realm.tags} />
        <AdvertActions overview={overview} />
      </div>
    </Card>
  );
}
