"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import { splashGold } from "~/lib/splash/mycountry-gold";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/utils";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { Skeleton } from "~/components/ui/skeleton";

const DISCORD_CDN_HOSTNAMES = ["cdn.discordapp.com", "media.discordapp.net"];

function proxyDiscordUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (DISCORD_CDN_HOSTNAMES.includes(parsed.hostname)) {
      const path = `/api/proxy-discord-image?url=${encodeURIComponent(url)}`;
      if (process.env.NODE_ENV === "production") {
        return `${mediaWikiOrigin()}/projects/ixstates${path}`;
      }
      return createUrl(path);
    }
  } catch {
    // not an absolute URL — handled as a path below
  }
  if (url.startsWith("/")) {
    let cleanPath = url;
    if (cleanPath.startsWith("/projects/ixstates/")) {
      cleanPath = cleanPath.slice("/projects/ixstates".length);
    } else if (cleanPath.startsWith("/projects/ixstates")) {
      cleanPath = cleanPath.slice("/projects/ixstates".length);
    }

    if (cleanPath.includes("/images/discord/")) {
      cleanPath = cleanPath.includes("?") ? `${cleanPath}&v=1` : `${cleanPath}?v=1`;
    }

    if (process.env.NODE_ENV === "production") {
      return `${mediaWikiOrigin()}/projects/ixstates${cleanPath}`;
    }
    return createUrl(cleanPath);
  }
  return url;
}

function parseBlurbContent(post: {
  hashtags?: string[] | string | null;
  content?: string;
}): string {
  const content = post.content ?? "";
  let hashtags: string[] = [];
  if (Array.isArray(post.hashtags)) {
    hashtags = post.hashtags;
  } else if (typeof post.hashtags === "string") {
    try {
      hashtags = JSON.parse(post.hashtags);
    } catch {
      /* ignore */
    }
  }

  if (!hashtags.includes("blurb")) return content;

  const match = content.match(/^\[blurb:([^\]|]+)\|([^\]]+)\]\n\n([\s\S]*)$/);
  if (match) return match[3] ?? "";

  return content.replace(/\n\n.*?— Read full blurb →.*$/, "").trim();
}

type PeekMedia = { id: string; url: string; filename?: string | null };

export function SplashThinkPagesPeek() {
  const { data, isLoading } = api.thinkpages.getFeed.useQuery(
    { limit: 6, filter: "recent" },
    { staleTime: 60_000 }
  );

  const posts = data?.posts ?? [];

  if (isLoading) {
    return <Skeleton className="rounded-row h-36" />;
  }

  if (posts.length === 0) {
    return (
      <p className="text-label-secondary text-body leading-relaxed">
        No public ThinkPages posts yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {posts.map((post) => {
        const flag = post.account.country?.flag;
        const nation = post.account.country?.name ?? "";
        const profileUrl = post.account.profileImageUrl;
        const displayName = (post.account.displayName ?? post.account.username ?? "").trim() || "?";
        const htmlBody = formatThinkpagesContentForDisplay(parseBlurbContent(post));
        const media = (post.mediaAttachments ?? []) as PeekMedia[];

        return (
          <li key={post.id}>
            <div
              className={cn(
                "hover:bg-fill-4 rounded-row border p-3 transition-colors",
                splashGold.border
              )}
            >
              <div className="flex gap-3">
                <Link
                  href={`/dashboard/post/${post.id}`}
                  className="relative flex shrink-0 flex-col items-center gap-1"
                >
                  <div className="border-separator bg-fill-3 rounded-control-sm relative h-10 w-10 shrink-0 overflow-hidden border">
                    {flag ? (
                      <img
                        src={proxyDiscordUrl(flag)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-label-secondary text-caption flex h-full w-full items-center justify-center">
                        TP
                      </span>
                    )}
                  </div>
                  <Avatar className="border-separator h-7 w-7 border">
                    <AvatarImage src={profileUrl ?? undefined} alt="" />
                    <AvatarFallback className="text-caption font-semibold">
                      {displayName
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="min-w-0 flex-1 space-y-2">
                  <Link href={`/dashboard/post/${post.id}`} className="block">
                    <p className="text-label text-body line-clamp-2 font-medium">
                      @{post.account.username}
                      {nation ? (
                        <span className="text-label-secondary font-normal">
                          {" "}
                          · {nation.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </p>
                  </Link>

                  <div className="text-label-secondary text-body [&_a]:text-blue [&_img]:rounded-control-sm max-h-44 overflow-hidden leading-relaxed [&_a]:break-all hover:[&_a]:underline [&_img]:my-1 [&_img]:max-h-40 [&_img]:w-auto [&_img]:max-w-full [&_p]:my-1 [&_p]:first:mt-0 [&_svg]:inline-block [&_svg]:h-4 [&_svg]:w-4 [&_svg]:align-[-0.125em]">
                    <WikiHtmlContent html={htmlBody} className="break-words" />
                  </div>

                  {media.length > 0 ? (
                    <div
                      className={cn(
                        "rounded-control mt-1 overflow-hidden",
                        media.length === 1 && "max-w-xs",
                        media.length > 1 && "grid grid-cols-2 gap-1"
                      )}
                    >
                      {media.slice(0, 4).map((m, idx) => (
                        <Link
                          key={m.id}
                          href={`/dashboard/post/${post.id}`}
                          className={cn(
                            "bg-fill-3 rounded-control-sm relative block overflow-hidden",
                            media.length === 1 ? "aspect-video max-h-32" : "aspect-square max-h-20"
                          )}
                        >
                          <img
                            src={proxyDiscordUrl(m.url)}
                            alt={m.filename || `Attachment ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <p className="text-label-secondary text-footnote tabular-nums">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </p>
                    <Link
                      href={`/dashboard/post/${post.id}`}
                      className={cn("text-caption", splashGold.link)}
                    >
                      Open post
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
