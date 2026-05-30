"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/trpc/react";
import { splashGold } from "~/lib/splash/mycountry-gold";
import { formatThinkpagesContentForDisplay } from "~/lib/text-formatter";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";

const DISCORD_CDN_HOSTNAMES = ["cdn.discordapp.com", "media.discordapp.net"];

function proxyDiscordUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (DISCORD_CDN_HOSTNAMES.includes(parsed.hostname)) {
      const path = `/api/proxy-discord-image?url=${encodeURIComponent(url)}`;
      if (process.env.NODE_ENV === "production") {
        return `https://ixwiki.com/projects/ixstates${path}`;
      }
      return createUrl(path);
    }
  } catch {}
  if (url.startsWith("/")) {
    if (process.env.NODE_ENV === "production") {
      const pathWithoutBp = url.startsWith("/projects/ixstates")
        ? url.slice("/projects/ixstates".length)
        : url;
      return `https://ixwiki.com/projects/ixstates${pathWithoutBp}`;
    }
    return createUrl(url);
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
    return <div className={`h-36 animate-pulse rounded-xl ${splashGold.subtlePanel}`} />;
  }

  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        Public ThinkPages posts appear here as soon as someone publishes — the feed is live.
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
                "hover:bg-muted/30 rounded-xl border p-3 transition-colors",
                splashGold.border
              )}
            >
              <div className="flex gap-3">
                <Link
                  href={`/thinkpages/post/${post.id}`}
                  className="relative flex shrink-0 flex-col items-center gap-1"
                >
                  <div className="border-border bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-md border">
                    {flag ? (
                      <img src={proxyDiscordUrl(flag)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-medium">
                        TP
                      </span>
                    )}
                  </div>
                  <Avatar className="border-border h-7 w-7 border">
                    <AvatarImage src={profileUrl ?? undefined} alt="" />
                    <AvatarFallback className="text-[9px] font-semibold">
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
                  <Link href={`/thinkpages/post/${post.id}`} className="block">
                    <p className="text-foreground line-clamp-2 text-sm font-medium">
                      @{post.account.username}
                      {nation ? (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {nation.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </p>
                  </Link>

                  <div className="text-muted-foreground max-h-44 overflow-hidden text-sm leading-relaxed [&_a]:break-all [&_a]:text-blue-600 hover:[&_a]:underline dark:[&_a]:text-blue-400 [&_img]:my-1 [&_img]:max-h-40 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-md [&_p]:my-1 [&_p]:first:mt-0 [&_svg]:inline-block [&_svg]:h-4 [&_svg]:w-4 [&_svg]:align-[-0.125em]">
                    <WikiHtmlContent html={htmlBody} className="break-words" />
                  </div>

                  {media.length > 0 ? (
                    <div
                      className={cn(
                        "mt-1 overflow-hidden rounded-lg",
                        media.length === 1 && "max-w-xs",
                        media.length > 1 && "grid grid-cols-2 gap-1"
                      )}
                    >
                      {media.slice(0, 4).map((m, idx) => (
                        <Link
                          key={m.id}
                          href={`/thinkpages/post/${post.id}`}
                          className={cn(
                            "bg-muted relative block overflow-hidden rounded-md",
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
                    <p className="text-muted-foreground text-[10px] tabular-nums">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </p>
                    <Link
                      href={`/thinkpages/post/${post.id}`}
                      className={cn("text-xs font-medium", splashGold.link)}
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
