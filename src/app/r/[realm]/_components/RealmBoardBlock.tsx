"use client";

import Link from "next/link";
import { RealmAvatar } from "~/app/realms/_components/RealmAvatar";
import { BoardPreviewList } from "~/components/thinkpages-forum/realm/BoardPreviewList";
import { Skeleton } from "~/components/ui/skeleton";
import { realmBoardHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface RealmBoardBlockProps {
  slug: string;
  /** Draw its own bordered card (the realm feed); the overview puts it inside a section instead. */
  framed?: boolean;
  className?: string;
}

/**
 * "On the board": a realm's newest three board messages (persona-safe, as the server shapes them) with a link to the
 * live board. Used by the realm overview and the realm feed. Renders nothing for a realm the viewer cannot see or a
 * failed read, a skeleton while loading. Links use the slug the server returns (the canonical one), not the one asked.
 */
export function RealmBoardBlock({ slug, framed = false, className }: RealmBoardBlockProps) {
  const { data, isLoading } = api.thinkpagesForum.realmBoardPreview.useQuery(
    { slug },
    { staleTime: 60_000, refetchOnWindowFocus: false, retry: false }
  );
  if (isLoading) return <Skeleton className={cn("rounded-card h-24 w-full", className)} />;
  if (!data) return null;
  const { realm, messages } = data;
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        framed && "border-separator rounded-card border p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <RealmAvatar thumbnail={realm.emblemUrl || realm.thumbnail} className="size-9" />
        <div className="min-w-0 flex-1">
          <h3 className="text-label text-headline">On the board</h3>
          <p className="text-label-secondary text-footnote truncate">{realm.name}</p>
        </div>
        <Link
          href={realmBoardHref(realm.slug)}
          className="text-tint text-footnote focus-visible:outline-tint shrink-0 hover:underline focus-visible:outline-2 pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          Open the board
        </Link>
      </div>
      {messages.length === 0 ? (
        <p className="text-label-secondary text-body">Nobody has posted on the board yet.</p>
      ) : (
        <BoardPreviewList messages={messages} />
      )}
    </div>
  );
}
