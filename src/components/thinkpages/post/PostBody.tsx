"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import { SportsBulletinCard } from "~/components/thinkpages/SportsBulletinCard";
import { FeedPollWidget } from "~/components/ui/FeedPollWidget";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import {
  PostInlineLinkPreview,
  getInlinePreviewLink,
} from "./PostInlineLinkPreview";
import { parseSportsBulletin, type SportsBulletinData } from "~/lib/sports/feed-bulletins";

export interface PostBodyProps {
  content: string;
  cleanContent: string;
  blurbMeta?: {
    isBlurb: boolean;
    promptTitle?: string;
    promptSlug?: string;
  };
  sportsBulletin?: SportsBulletinData | null;
  account?: {
    displayName?: string;
    username?: string;
    profileImageUrl?: string;
  } | null;
  poll?: any;
  visualizations?: any[];
  inlinePreview?: React.ReactNode;
  isHero?: boolean;
  className?: string;
}

export function PostBody({
  content,
  cleanContent,
  blurbMeta,
  sportsBulletin: inputSportsBulletin,
  account,
  poll,
  inlinePreview,
  isHero = false,
  className,
}: PostBodyProps) {
  const sportsBulletin = useMemo(() => {
    if (inputSportsBulletin !== undefined) return inputSportsBulletin;
    return parseSportsBulletin(cleanContent);
  }, [inputSportsBulletin, cleanContent]);

  const matchedLink = useMemo(() => getInlinePreviewLink(content), [content]);

  return (
    <div className={className}>
      {/* Blurb Header Badge */}
      {blurbMeta?.isBlurb && (
        <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-purple-400">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="tracking-tight">{blurbMeta.promptTitle ?? "Topic Tuesday"}</span>
          {blurbMeta.promptSlug && (
            <Link
              href={`/thinkpages/topic/${blurbMeta.promptSlug}`}
              className="text-purple-400/80 hover:text-purple-300 hover:underline"
            >
              View Topic →
            </Link>
          )}
        </div>
      )}

      {/* Main Body Content: Sports Card or Wikitext/HTML */}
      {sportsBulletin ? (
        <SportsBulletinCard data={sportsBulletin} author={account} />
      ) : (
        <div
          className={
            isHero
              ? "mt-2 select-text text-[20px] font-normal leading-relaxed text-slate-100 whitespace-pre-wrap"
              : "select-text text-sm font-normal leading-relaxed text-slate-200 whitespace-pre-wrap"
          }
        >
          <WikiHtmlContent html={formatThinkpagesContentForDisplay(cleanContent)} />
        </div>
      )}

      {/* Embedded Poll */}
      {poll && (
        <div className="mt-3">
          <FeedPollWidget poll={poll} />
        </div>
      )}

      {/* Inline Link Preview (suppressed if sports bulletin active) */}
      {!sportsBulletin && (inlinePreview || (matchedLink && <PostInlineLinkPreview url={matchedLink} />))}
    </div>
  );
}
