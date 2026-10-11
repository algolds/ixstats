"use client";

import Link from "next/link";
import { skipToken } from "@tanstack/react-query";
import { Community, NavArrowRight } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { useForumNavFlags } from "~/components/shell/use-forum-nav-flags";
import { timeAgo } from "~/lib/format/compact";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { countLabel } from "~/lib/thinkpages-forum/unread";
import { api, type RouterOutputs } from "~/trpc/react";
import { AuthorName } from "../AuthorName";
import { IconTile } from "../shell";

type HubThread = RouterOutputs["thinkpagesForum"]["category"]["threads"][number];

const MINE_HREF = "/thinkpages/r/mine";

/**
 * "Your realm", for a signed-in member of a realm: its name and its Hub's latest thread, linking to
 * `/thinkpages/r/mine`. Nothing for anyone else.
 */
export function YourRealmCard({ signedIn }: { signedIn: boolean }) {
  const { realmMember } = useForumNavFlags(signedIn);
  const realms = api.thinkpagesForum.realms.useQuery(undefined, { enabled: realmMember });
  const slug = realmMember ? realms.data?.defaultSlug : undefined;
  const hub = api.thinkpagesForum.category.useQuery(
    slug ? { key: REALM_HUB_KEY, realm: slug, page: 1, sort: "latest" } : skipToken
  );
  const counts = api.thinkpagesForum.navCounts.useQuery(undefined, {
    enabled: realmMember,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const name = realms.data?.realms.find((r) => r.slug === slug)?.name;
  if (!slug || !name) return null;

  // Pinned threads sort first on the Hub; "latest" means the newest activity among what is shown.
  const latest = hub.data?.threads.reduce<HubThread | undefined>(
    (best, t) => (!best || t.lastPostAt > best.lastPostAt ? t : best),
    undefined
  );

  return (
    <Card content="entity" className="overflow-hidden">
      <Link
        href={MINE_HREF}
        className="hover:bg-fill-4 focus-visible:outline-tint flex items-center gap-3.5 px-4 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-5 pointer-coarse:min-h-11"
      >
        <IconTile size="lg" texture="paperGrain">
          <Community />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="text-title-3 flex items-center gap-2">
            <span className="min-w-0 truncate">{name}</span>
            <Badge variant="secondary">Your realm</Badge>
          </span>
          {counts.data && counts.data.realmBoardNew > 0 ? (
            <span className="text-callout text-tint block font-medium tabular-nums">
              {`${countLabel(counts.data.realmBoardNew)} new on the board`}
            </span>
          ) : null}
          {latest && hub.data ? (
            <span className="text-callout text-label-secondary flex min-w-0 items-center gap-1">
              <span className="text-label min-w-0 truncate">{latest.title}</span>
              <span aria-hidden>·</span>
              <AuthorName
                authors={hub.data.authors}
                userId={latest.authorUserId}
                personaId={latest.authorPersonaId}
                importedName={latest.importedAuthorName}
              />
              <span className="shrink-0 tabular-nums">{timeAgo(latest.lastPostAt)}</span>
            </span>
          ) : null}
        </span>
        <NavArrowRight aria-hidden className="text-label-tertiary size-4 shrink-0" />
      </Link>
    </Card>
  );
}
