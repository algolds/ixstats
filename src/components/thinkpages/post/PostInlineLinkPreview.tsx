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
    <div className="group/preview bg-surface-secondary hover:bg-fill-3 rounded-row mt-2 flex items-center justify-between p-3 transition-colors duration-150">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-body">🏆</span>
        <div className="min-w-0">
          <div className="text-headline text-label truncate">{leagueData?.name ?? "League"}</div>
          {leagueData && (
            <div className="text-label-secondary text-footnote capitalize">
              {leagueData.sportPreset} · {leagueData.archetype}
            </div>
          )}
        </div>
      </div>
      <Link
        href={`/myleague/${leagueId}`}
        className="text-caption text-tint ml-2 shrink-0 hover:underline"
      >
        View League →
      </Link>
    </div>
  );
}

export function MyClubInlinePreview({ teamId }: { teamId: string }) {
  const { data: teamData } = api.sports.getTeam.useQuery({ id: teamId }, { enabled: !!teamId });

  return (
    <div className="group/preview bg-surface-secondary hover:bg-fill-3 rounded-row mt-2 flex items-center justify-between p-3 transition-colors duration-150">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-body" style={{ color: teamData?.color || "var(--color-info)" }}>
          🛡️
        </span>
        <div className="min-w-0">
          <div className="text-headline text-label truncate">{teamData?.name ?? "Club"}</div>
          {teamData && (
            <div className="text-label-secondary text-footnote">
              Stadium Cap: <span className="tabular-nums">{teamData.stadiumCapacity}</span>
            </div>
          )}
        </div>
      </div>
      <Link
        href={`/myclub/${teamId}`}
        className="text-caption text-tint ml-2 shrink-0 hover:underline"
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
      <div className="group/preview bg-surface-secondary hover:bg-fill-3 rounded-row mt-2 flex items-center justify-between p-3 transition-colors duration-150">
        <div className="flex min-w-0 items-center gap-3">
          <MessageCircle className="text-indigo size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-headline text-label truncate">
              {thread?.title ?? "Forum Thread"}
            </div>
            {thread && (
              <div className="text-label-secondary text-footnote">
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
          className="text-caption text-tint ml-2 shrink-0 hover:underline"
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
