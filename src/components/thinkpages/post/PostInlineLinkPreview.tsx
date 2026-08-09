"use client";

import {
  WikiLinkPreview,
  ForumLinkPreview,
  MyLeagueInlinePreview,
  MyClubInlinePreview,
} from "~/components/wiki/WikiLinkPreview";

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
    return <MyLeagueInlinePreview leagueId={leagueId} url={url} />;
  }

  if (myClubMatch) {
    const teamId = myClubMatch[1]!;
    return <MyClubInlinePreview teamId={teamId} url={url} />;
  }

  if (wikiMatch) {
    const articleTitle = decodeURIComponent(wikiMatch[2]!);
    return <WikiLinkPreview articleTitle={articleTitle} wiki={wikiMatch[1]!} url={url} />;
  }

  if (forumMatch) {
    const threadId = forumMatch[1]!;
    return <ForumLinkPreview threadId={threadId} url={url} />;
  }

  return null;
}
