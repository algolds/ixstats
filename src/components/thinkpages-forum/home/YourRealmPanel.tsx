"use client";

import Link from "next/link";
import { skipToken } from "@tanstack/react-query";
import { Community, NavArrowRight } from "iconoir-react";
import { useForumNavFlags } from "~/components/shell/use-forum-nav-flags";
import { assetUrl } from "~/lib/base-path";
import { timeAgo } from "~/lib/format/compact";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { countLabel } from "~/lib/thinkpages-forum/unread";
import { api, type RouterOutputs } from "~/trpc/react";
import { AuthorName } from "../AuthorName";
import { IconTile, RailPanel } from "../shell";

type HubThread = RouterOutputs["thinkpagesForum"]["category"]["threads"][number];

const MINE_HREF = "/thinkpages/r/mine";

/**
 * The rail's "Your realm" panel, for a signed-in member of a realm: its name, what is new on its board and its Hub's
 * latest thread, linking to `/thinkpages/r/mine`. Nothing for anyone else.
 */
export function YourRealmPanel({ signedIn }: { signedIn: boolean }) {
  const { realmMember, realm } = useForumNavFlags(signedIn);
  // The realm's uploaded emblem, else its thumbnail; the realms icon when it has neither.
  const mark = assetUrl(realm?.emblemUrl) ?? assetUrl(realm?.thumbnail);
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
    <RailPanel title="Your realm" icon={<Community />}>
      <Link
        href={MINE_HREF}
        className="hover:bg-fill-4 focus-visible:outline-tint rounded-control-sm -mx-2 flex items-center gap-3 px-2 py-2 focus-visible:outline-2 pointer-coarse:min-h-11"
      >
        {mark ? (
          <img
            src={mark}
            alt=""
            referrerPolicy="no-referrer"
            className="rounded-row size-10 shrink-0 object-cover"
          />
        ) : (
          <IconTile texture="paperGrain">
            <Community />
          </IconTile>
        )}
        <span className="min-w-0 flex-1">
          <span className="text-body text-label block truncate font-medium">{name}</span>
          {counts.data && counts.data.realmBoardNew > 0 ? (
            <span className="text-footnote text-tint block font-medium tabular-nums">
              {`${countLabel(counts.data.realmBoardNew)} new on the board`}
            </span>
          ) : null}
          {latest && hub.data ? (
            <span className="text-footnote text-label-secondary flex min-w-0 items-center gap-1">
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
    </RailPanel>
  );
}
