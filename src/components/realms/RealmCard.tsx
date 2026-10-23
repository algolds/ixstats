"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  openToJoinCount,
  plural,
  realmBadge,
  realmHref,
  type DirectoryRealm,
} from "~/app/realms/_components/realm-directory";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { RealmMapFace } from "~/components/realms/RealmMapFace";
import { useMapDrift } from "~/components/realms/use-map-drift";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { SharedElement } from "~/components/ui/view-transition";
import { cn } from "~/lib/utils";
import { RealmAdvertCard, type AdvertOverview } from "./RealmAdvertCard";

function boardActivity(board: DirectoryRealm["board"]): string {
  if (board.recentPosts === 0 && !board.lastPostAt) return "No posts yet";
  const week = `${plural(board.recentPosts, "post")} this week`;
  if (!board.lastPostAt) return week;
  return `${week} · last ${new Date(board.lastPostAt).toLocaleDateString()}`;
}

/** The way in: Join for a newcomer, Claim another below the cap, and the holding itself at the cap. */
function JoinAction({ realm }: { realm: DirectoryRealm }) {
  const { myNationCount, maxNationsPerUser } = realm;
  const nations = realmHref(realm.slug, "nations");
  return (
    <div className="mt-auto flex flex-wrap items-center gap-3">
      {myNationCount < maxNationsPerUser && (
        <Button
          asChild
          size="sm"
          variant={myNationCount > 0 ? "outline" : "default"}
          className="z-raised relative"
        >
          <Link
            href={nations}
            aria-label={
              myNationCount > 0 ? `Claim another nation in ${realm.name}` : `Join ${realm.name}`
            }
          >
            {myNationCount > 0 ? "Claim another" : "Join"}
          </Link>
        </Button>
      )}
      {myNationCount > 0 && (
        <span className="text-label-secondary text-footnote">
          You hold {myNationCount} of {maxNationsPerUser}
        </span>
      )}
    </div>
  );
}

/** The press, as the CSS `scale` property (which `transform-none` would not reset), so Reduce Motion simply omits it. */
const PRESS = "has-[a[data-stretch]:active]:scale-[.985]";

/**
 * A realm in the atlas: its map face under a crest, the name stretched over the card as one link, and a way to join.
 * The face drifts against the pointer and is the shared element that morphs into the realm page header.
 */
function DirectoryRealmCard({ realm }: { realm: DirectoryRealm }) {
  const reduceMotion = useFacetReducedMotion();
  const { drift, onPointerMove, onPointerLeave } = useMapDrift();
  const open = openToJoinCount(realm);
  const pointer = reduceMotion ? {} : { onPointerMove, onPointerLeave };
  return (
    <li>
      <Card
        content="entity"
        className={cn(
          "hover:ring-tint/40 has-[a[data-stretch]:focus-visible]:outline-tint relative flex flex-col overflow-hidden transition-transform duration-100 ease-out hover:ring-1 has-[a[data-stretch]:focus-visible]:outline-2 has-[a[data-stretch]:focus-visible]:outline-offset-2",
          !reduceMotion && PRESS
        )}
        {...pointer}
      >
        <div className="relative">
          <div className="relative h-36 overflow-hidden">
            <SharedElement name={`realm-map-${realm.slug}`}>
              <motion.div style={drift} className="h-full w-full scale-[1.08]">
                <RealmMapFace
                  realm={realmBadge(realm)}
                  bannerUrl={realm.bannerUrl}
                  showCrest={false}
                />
              </motion.div>
            </SharedElement>
            {open > 0 && (
              <Badge variant="secondary" className="absolute top-3 right-3">
                <span
                  data-testid="open-swatch"
                  aria-hidden="true"
                  className="bg-fill-3 mr-1.5 inline-block size-2.5 rounded-sm bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--color-tint)_55%,transparent)_0_1.5px,transparent_1.5px_4.5px)]"
                />
                {open.toLocaleString()} open
              </Badge>
            )}
          </div>
          <RealmCrest
            realm={realmBadge(realm)}
            size="lg"
            className="ring-surface absolute -bottom-6 left-4 ring-3"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4 pt-9">
          <Link
            href={realmHref(realm.slug)}
            data-stretch
            className="text-label text-headline block truncate outline-none after:absolute after:inset-0 after:content-['']"
          >
            {realm.name}
          </Link>
          {realm.description && (
            <p className="text-label-secondary text-footnote line-clamp-2">{realm.description}</p>
          )}
          {realm.tags.length > 0 && (
            <p className="text-label-secondary text-footnote">{realm.tags.join(" · ")}</p>
          )}
          <p className="text-label-secondary text-footnote">
            {`${plural(realm.nationCount, "nation")} · ${boardActivity(realm.board)}`}
          </p>
          <JoinAction realm={realm} />
        </div>
      </Card>
    </li>
  );
}

export type RealmCardProps =
  | { variant?: "directory"; realm: DirectoryRealm }
  | { variant: "advert"; overview: AdvertOverview };

/**
 * A realm as a card. The directory variant is a list item for the realms directory; the advert variant heads a Find a
 * Realm advert thread and is fed by `realms.region.overview` (live data, never a stored snapshot).
 */
export function RealmCard(props: RealmCardProps) {
  if (props.variant === "advert") return <RealmAdvertCard overview={props.overview} />;
  return <DirectoryRealmCard realm={props.realm} />;
}
