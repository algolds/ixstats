"use client";

import Link from "next/link";
import { ChatBubble as MessageCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { ForumLinkPreview } from "~/components/wiki-os/reader/WikiLinkPreview";
import { InlineWikiArticlePreview } from "~/components/dashboard/sections/feed/InlineWikiArticlePreview";
import { mediaWikiHostPattern } from "~/lib/wiki-os/config";

/** A link to a MyLeague or MyClub page: any subdomain of the app's public host (it serves IxStates too) or localhost, then the base path. */
const APP_PAGE_LINK = (route: "myleague" | "myclub") =>
  new RegExp(
    `(?:https?:\\/\\/)?(?:[a-zA-Z0-9-]+\\.)*(?:${mediaWikiHostPattern()}|localhost:\\d+)?(?:\\/projects\\/ixstates)?\\/${route}\\/([a-zA-Z0-9_-]+)`,
    "i"
  );
const MY_LEAGUE_LINK = APP_PAGE_LINK("myleague");
const MY_CLUB_LINK = APP_PAGE_LINK("myclub");

/** A link to an article of IxWiki (by the configured public host) or IIWiki; group 1 is the host, group 2 the title. */
const WIKI_ARTICLE_LINK = new RegExp(
  `(?:https?:\\/\\/)?(${mediaWikiHostPattern()}|(?:www\\.)?iiwiki\\.com)\\/wiki\\/([^#?\\s)]+)`,
  "i"
);

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

  const myLeagueMatch = content.match(MY_LEAGUE_LINK);
  if (myLeagueMatch) return myLeagueMatch[0];

  const myClubMatch = content.match(MY_CLUB_LINK);
  if (myClubMatch) return myClubMatch[0];

  const wikiMatch = content.match(WIKI_ARTICLE_LINK);
  if (wikiMatch) return wikiMatch[0];

  const forumMatch = content.match(
    /(?:https?:\/\/)?(?:www\.)?forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/i
  );
  if (forumMatch) return forumMatch[0];

  return null;
}

export function PostInlineLinkPreview({ url }: { url: string }) {
  const myLeagueMatch = url.match(MY_LEAGUE_LINK);
  const myClubMatch = url.match(MY_CLUB_LINK);
  const wikiMatch = url.match(WIKI_ARTICLE_LINK);
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
