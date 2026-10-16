"use client";

import Link from "next/link";
import { Community, NavArrowRight } from "iconoir-react";
import { useForumNavFlags } from "~/components/shell/use-forum-nav-flags";
import { assetUrl } from "~/lib/base-path";
import { cn } from "~/lib/utils/cn";
import { timeAgo } from "~/lib/format/compact";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { IconTile } from "../shell";
import { UnreadCount, UnreadMark } from "../UnreadMark";

const MINE_HREF = "/thinkpages/r/mine";

/**
 * The home's "Your realm" card, leading the main column, for a signed-in member of a realm: its name, what is new on its board and its newest board message, linking to `/thinkpages/r/mine`. Nothing for anyone else.
 */
export function YourRealmPanel({ signedIn }: { signedIn: boolean }) {
  const { realmMember, realm } = useForumNavFlags(signedIn);
  // The realm's uploaded emblem, else its thumbnail; the realms icon when it has neither.
  const mark = assetUrl(realm?.emblemUrl) ?? assetUrl(realm?.thumbnail);
  const panel = api.thinkpagesForum.realmPanel.useQuery(undefined, {
    enabled: realmMember,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const counts = api.thinkpagesForum.navCounts.useQuery(undefined, {
    enabled: realmMember,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  if (!realmMember) return null;
  // Held at the row's height while the board loads, so the boards below do not jump when the card fills in.
  const pending = panel.isLoading;
  if (!pending && !panel.data) return null;
  const name = panel.data?.realm.name;
  const newOnBoard = counts.data?.realmBoardNew ?? 0;
  // The board's messages arrive newest first.
  const newest = panel.data?.messages[0];

  return (
    <Card content="data" padding="md">
      <CardHeader className="px-0 pb-3">
        <CardTitle icon={<Community />} role="heading" aria-level={2}>
          Your realm
        </CardTitle>
      </CardHeader>
      <CardContent className="text-body px-0">
        {pending ? (
          <Skeleton data-testid="your-realm-placeholder" className="h-14 w-full" />
        ) : (
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
              <span className="flex min-w-0 items-baseline gap-2">
                {newOnBoard > 0 ? <UnreadMark /> : null}
                <span
                  className={cn(
                    "text-body text-label block min-w-0 flex-1 truncate",
                    newOnBoard > 0 ? "font-semibold" : "font-medium"
                  )}
                >
                  {name}
                </span>
                {newOnBoard > 0 ? <UnreadCount count={newOnBoard} suffix="on the board" /> : null}
              </span>
              {newest ? (
                <span className="text-footnote text-label-secondary flex min-w-0 items-center gap-1">
                  <span className="text-label max-w-1/3 shrink-0 truncate font-medium">
                    {newest.author.name}
                  </span>
                  <span aria-hidden>·</span>
                  {newest.excerpt ? (
                    <span className="min-w-0 truncate">{newest.excerpt}</span>
                  ) : null}
                  <span className="shrink-0 tabular-nums">{timeAgo(newest.createdAt)}</span>
                </span>
              ) : null}
            </span>
            <NavArrowRight aria-hidden className="text-label-tertiary size-4 shrink-0" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
