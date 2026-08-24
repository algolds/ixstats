"use client";

import Link from "next/link";
import { ChatBubble as MessageCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { ForumLinkPreview } from "~/components/wiki-os/reader/WikiLinkPreview";
import { InlineWikiArticlePreview } from "~/components/dashboard/sections/feed/InlineWikiArticlePreview";

export function MyLeagueInlinePreview({ leagueId }: { leagueId: string }) {
  const { data: leagueData } = api.sports.getLeague.useQuery(
    { id: leagueId },
    { enabled: !!leagueId }
  );

  return (
    <div className="group/preview mt-2 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-2.5 shadow-sm transition-all duration-150 hover:border-amber-500/35 hover:bg-amber-500/[0.08]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-base">🏆</span>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-amber-300">
            {leagueData?.name ?? "League"}
          </div>
          {leagueData && (
            <div className="text-muted-foreground text-[10px] capitalize">
              {leagueData.sportPreset} · {leagueData.archetype}
            </div>
          )}
        </div>
      </div>
      <Link
        href={`/myleague/${leagueId}`}
        className="ml-1.5 shrink-0 text-[10px] font-semibold text-amber-400/80 transition-colors hover:text-amber-300 active:scale-95"
      >
        View League →
      </Link>
    </div>
  );
}

export function MyClubInlinePreview({ teamId }: { teamId: string }) {
  const { data: teamData } = api.sports.getTeam.useQuery({ id: teamId }, { enabled: !!teamId });

  return (
    <div className="group/preview mt-2 flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-2.5 shadow-sm transition-all duration-150 hover:border-blue-500/35 hover:bg-blue-500/[0.08]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="text-base" style={{ color: teamData?.color || "var(--color-info)" }}>
          🛡️
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-blue-300">{teamData?.name ?? "Club"}</div>
          {teamData && (
            <div className="text-muted-foreground text-[10px]">
              Stadium Cap: {teamData.stadiumCapacity}
            </div>
          )}
        </div>
      </div>
      <Link
        href={`/myclub/${teamId}`}
        className="ml-1.5 shrink-0 text-[10px] font-semibold text-blue-400/80 transition-colors hover:text-blue-300 active:scale-95"
      >
        View Club →
      </Link>
    </div>
  );
}

export function InlineForumThreadPreview({ threadId, url }: { threadId: number; url: string }) {
  const { data: thread } = api.wikios.getForumThreadPreview.useQuery(
    { threadId },
    { enabled: threadId > 0 }
  );

  return (
    <ForumLinkPreview threadId={threadId}>
      <div className="group/preview mt-2 flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-2.5 shadow-sm transition-all duration-150 hover:border-indigo-500/35 hover:bg-indigo-500/[0.08]">
        <div className="flex min-w-0 items-center gap-2.5">
          <MessageCircle className="h-4 w-4 shrink-0 text-indigo-400" />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-indigo-300">
              {thread?.title ?? "Forum Thread"}
            </div>
            {thread && (
              <div className="text-muted-foreground text-[10px]">
                {thread.forumName ? `${thread.forumName} · ` : ""}
                {thread.replyCount ?? 0} replies
              </div>
            )}
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1.5 shrink-0 text-[10px] font-semibold text-indigo-400/80 transition-colors hover:text-indigo-300 active:scale-95"
        >
          View Thread →
        </a>
      </div>
    </ForumLinkPreview>
  );
}

export function getInlinePreviewLink(content: string | null | undefined): string | null {
  if (!content) return null;

  const myLeagueMatch = content.match(
    /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)*(?:ixwiki\.com|localhost:\d+)?(?:\/projects\/ixstates)?\/myleague\/([a-zA-Z0-9_-]+)/i
  );
  if (myLeagueMatch) return myLeagueMatch[0];

  const myClubMatch = content.match(
    /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)*(?:ixwiki\.com|localhost:\d+)?(?:\/projects\/ixstates)?\/myclub\/([a-zA-Z0-9_-]+)/i
  );
  if (myClubMatch) return myClubMatch[0];

  const wikiMatch = content.match(
    /(?:https?:\/\/)?(?:www\.)?(ixwiki\.com|iiwiki\.com)\/wiki\/([^#?\s)]+)/i
  );
  if (wikiMatch) return wikiMatch[0];

  const forumMatch = content.match(
    /(?:https?:\/\/)?(?:www\.)?forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/i
  );
  if (forumMatch) return forumMatch[0];

  return null;
}

export function PostInlineLinkPreview({ url }: { url: string }) {
  const myLeagueMatch = url.match(
    /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)*(?:ixwiki\.com|localhost:\d+)?(?:\/projects\/ixstates)?\/myleague\/([a-zA-Z0-9_-]+)/i
  );
  const myClubMatch = url.match(
    /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)*(?:ixwiki\.com|localhost:\d+)?(?:\/projects\/ixstates)?\/myclub\/([a-zA-Z0-9_-]+)/i
  );
  const wikiMatch = url.match(
    /(?:https?:\/\/)?(?:www\.)?(ixwiki\.com|iiwiki\.com)\/wiki\/([^#?\s)]+)/i
  );
  const forumMatch = url.match(
    /(?:https?:\/\/)?(?:www\.)?forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/i
  );

  if (myLeagueMatch) {
    const leagueId = myLeagueMatch[1]!;
    return <MyLeagueInlinePreview leagueId={leagueId} />;
  }

  if (myClubMatch) {
    const teamId = myClubMatch[1]!;
    return <MyClubInlinePreview teamId={teamId} />;
  }

  if (wikiMatch) {
    const articleTitle = decodeURIComponent(wikiMatch[2]!).replace(/_/g, " ");
    const wikiSource = wikiMatch[1]?.includes("iiwiki") ? "iiwiki" : "ixwiki";
    return <InlineWikiArticlePreview title={articleTitle} wiki={wikiSource} />;
  }

  if (forumMatch) {
    const threadId = parseInt(forumMatch[1]!, 10);
    return <InlineForumThreadPreview threadId={threadId} url={url} />;
  }

  return null;
}
