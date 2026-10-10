"use client";

import Link from "next/link";
import { skipToken } from "@tanstack/react-query";
import { Community, NavArrowRight } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { useForumNavFlags } from "~/components/shell/use-forum-nav-flags";
import { timeAgo } from "~/lib/format/compact";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { api, type RouterOutputs } from "~/trpc/react";
import { AuthorName } from "../AuthorName";

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
        className="hover:bg-fill-4 focus-visible:outline-tint flex items-center gap-3 px-5 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 pointer-coarse:min-h-11"
      >
        <span
          aria-hidden
          className="bg-tint-fill text-tint rounded-control-sm flex size-9 shrink-0 items-center justify-center [&_svg]:size-5"
        >
          <Community />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-headline flex items-baseline gap-2">
            <span className="min-w-0 truncate">{name}</span>
            <span className="text-footnote text-label-secondary font-normal">Your realm</span>
          </span>
          {latest && hub.data ? (
            <span className="text-footnote text-label-secondary flex min-w-0 items-center gap-1">
              <span className="text-callout text-label min-w-0 truncate">{latest.title}</span>
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
