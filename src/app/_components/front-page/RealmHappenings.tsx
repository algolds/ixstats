"use client";

import { Activity } from "iconoir-react";
import { HappeningLine } from "~/app/r/[realm]/_components/RealmSidebar";
import { cn } from "~/lib/utils/cn";
import { api } from "~/trpc/react";
import { FADE_IN_ROWS, Pane, PaneBody, type PaneQuery } from "./Pane";

const SHOWN = 8;
const REFRESH_MS = 60_000;

/**
 * The featured realm's newest happenings: nations, claims, embassies, officers and game events. Until the realm is
 * known, the pane shows the front page query's own loading or error state.
 */
export function RealmHappenings({
  realm,
  parent,
  className,
}: {
  realm: { slug: string; name: string } | undefined;
  parent: PaneQuery;
  className?: string;
}) {
  const query = api.realms.region.happenings.useQuery(
    { slug: realm?.slug ?? "", limit: SHOWN },
    { enabled: Boolean(realm), refetchInterval: REFRESH_MS }
  );
  const items = query.data?.items ?? [];
  return (
    <Pane
      icon={<Activity />}
      title="Happenings"
      link={realm && { href: `/r/${encodeURIComponent(realm.slug)}/happenings`, label: "See all" }}
      className={className}
    >
      <PaneBody
        query={realm ? query : parent}
        what="happenings"
        empty={items.length === 0 ? `No happenings in ${realm?.name ?? "this realm"} yet.` : null}
        rows={6}
      >
        <ul data-content="feed" className={cn(FADE_IN_ROWS, "[&>li]:py-2")}>
          {items.map((item) => (
            <HappeningLine key={item.id} item={item} />
          ))}
        </ul>
      </PaneBody>
    </Pane>
  );
}
