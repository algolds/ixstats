"use client";

import Link from "next/link";
import { RealmAvatar } from "~/app/realms/_components/RealmAvatar";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { BoardPreviewList } from "~/components/thinkpages-forum/realm/BoardPreviewList";
import { hubHref, realmBoardHref } from "~/lib/thinkpages-forum/links";
import { countLabel } from "~/lib/thinkpages-forum/unread";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const LINK = cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-coarse:min-h-11");

/**
 * Home's "Your realm": the realm of the signed-in viewer's current country, how many board messages are new to them
 * (sub-project 3's `navCounts`, the query the sidebar already polls) and the board's latest three. Nothing for a
 * viewer without a realm. Refreshes once a minute at most; there is no socket here.
 */
export function YourRealmPanel() {
  const panel = api.thinkpagesForum.realmPanel.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const counts = api.thinkpagesForum.navCounts.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  if (panel.isLoading) return <Skeleton className="rounded-card h-40" />;
  if (!panel.data) return null;
  const { realm, messages } = panel.data;
  const fresh = counts.data?.realmBoardNew ?? 0;
  return (
    <Card padding="md" content="entity" role="region" aria-label={`Your realm, ${realm.name}`}>
      <div className="flex items-center gap-3">
        <RealmAvatar thumbnail={realm.emblemUrl || realm.thumbnail} />
        <div className="min-w-0">
          <h2 className="text-headline text-label truncate">{realm.name}</h2>
          <p className="text-footnote text-label-secondary tabular-nums">
            {fresh > 0 ? `${countLabel(fresh)} new on the board` : "Up to date on the board"}
          </p>
        </div>
      </div>
      <div className="mt-3">
        {messages.length === 0 ? (
          <p className="text-label-secondary text-footnote">No messages on the board yet.</p>
        ) : (
          <BoardPreviewList messages={messages} />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={realmBoardHref(realm.slug)} className={LINK}>
          Open the board
        </Link>
        <Link href={hubHref(realm.slug)} className={LINK}>
          Forums
        </Link>
      </div>
    </Card>
  );
}
