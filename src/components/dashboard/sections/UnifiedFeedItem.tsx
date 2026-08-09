"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Globe,
  Landmark,
  Map as MapIcon,
  Rss,
  Shield,
  TrendingUp,
  Trophy,
  Users,
  BookOpen,
  MessageCircle,
  ChevronDown,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { FeedPollWidget } from "~/components/ui/FeedPollWidget";
import {
  WikiLinkPreview,
  ForumLinkPreview,
  WikiHtmlContent,
} from "~/components/wiki/WikiLinkPreview";
import { titleToWikiOSRoute } from "~/lib/wiki-os/url-compat";
import { resolveImageUrl, getImageUrl } from "~/lib/wiki-image-url";
import { parseSportsBulletin } from "~/lib/sports/feed-bulletins";
import { SportsBulletinCard } from "~/components/thinkpages/SportsBulletinCard";
import { formatTimeAgo } from "~/lib/time-utils";
import { formatThinkpagesContentForDisplay } from "~/lib/text-formatter";
import { cn } from "~/lib/utils";
import { WikiAuthorPopover } from "./WikiAuthorPopover";
import { FeedItemHeader } from "./feed/FeedItemHeader";
import { FeedGroupedDrawer } from "./feed/FeedGroupedDrawer";
import { InlineWikiArticlePreview, parseWikitextToHtml } from "./feed/InlineWikiArticlePreview";
import type { ProcessedFeedItem } from "~/types/dashboard-feed";

export { parseWikitextToHtml, InlineWikiArticlePreview };

export const SOURCE_CONFIG: Record<
  string,
  { icon: typeof Rss; color: string; bg: string; label: string }
> = {
  activity: { icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10", label: "Activity" },
  thinkpages: {
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Social",
  },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
};

export function getActivityLabel(activity: any): {
  label: string;
  icon: typeof Rss;
  color: string;
  bg: string;
} {
  const cat = activity.category ?? activity.content?.metadata?.category ?? "";
  const title = (activity.content?.title ?? "").toLowerCase();

  if (title.includes("point of interest") || title.includes("poi"))
    return { label: "POI", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (title.includes("city") || title.includes("settlement"))
    return { label: "City", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (
    title.includes("subdivision") ||
    title.includes("province") ||
    title.includes("state") ||
    title.includes("region")
  )
    return {
      label: "Subdivision",
      icon: MapIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  if (cat === "map" || title.includes("map") || title.includes("claim"))
    return { label: "Maps", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (
    cat === "economic" ||
    title.includes("gdp") ||
    title.includes("econom") ||
    title.includes("trade")
  )
    return {
      label: "Economy",
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  if (
    cat === "diplomatic" ||
    title.includes("embassy") ||
    title.includes("diplom") ||
    title.includes("treaty")
  )
    return { label: "Diplomacy", icon: Globe, color: "text-cyan-400", bg: "bg-cyan-500/10" };
  if (
    cat === "military" ||
    title.includes("military") ||
    title.includes("defense") ||
    title.includes("deploy")
  )
    return { label: "Defense", icon: Shield, color: "text-red-400", bg: "bg-red-500/10" };
  if (
    cat === "political" ||
    title.includes("govern") ||
    title.includes("politic") ||
    title.includes("election")
  )
    return { label: "Politics", icon: Landmark, color: "text-purple-400", bg: "bg-purple-500/10" };
  if (cat === "crisis" || title.includes("crisis"))
    return { label: "Crisis", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" };
  if (cat === "achievement" || title.includes("tier") || title.includes("achieve"))
    return { label: "Achievement", icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/10" };
  return { label: "Activity", icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10" };
}

export const UnifiedFeedItem = memo(function UnifiedFeedItem({ activity }: { activity: ProcessedFeedItem | any }) {
  const source = activity.source ?? "activity";
  const isWiki = source === "wiki";
  const isGrouped = !!activity._grouped;
  const [expanded, setExpanded] = useState(false);

  // Dynamic badge for IxStats activities
  const resolvedConfig = useMemo(() => {
    if (source === "activity") return getActivityLabel(activity);
    return SOURCE_CONFIG[source] ?? SOURCE_CONFIG.activity!;
  }, [source, activity]);

  const Icon = resolvedConfig.icon;
  const metadata = activity.content?.metadata ?? {};
  const externalUrl = metadata.wikiUrl ?? metadata.forumUrl;

  // Wiki page title for clickable link
  const wikiPageTitle = metadata.pageTitle as string | undefined;
  const wikiHref = wikiPageTitle ? titleToWikiOSRoute(wikiPageTitle) : null;

  const titleText = activity.content?.title ?? "";
  // For wiki items, strip the "Wiki edit: " or "New wiki page: " prefix
  const displayTitle =
    isWiki && wikiPageTitle
      ? activity._isNew
        ? "New page created"
        : isGrouped
          ? ""
          : titleText.replace(/^(Wiki edit|New wiki page):\s*/i, "")
      : titleText;
  const titleHtml = displayTitle ? formatThinkpagesContentForDisplay(displayTitle) : "";

  const descHtml = activity.content?.description
    ? formatThinkpagesContentForDisplay(activity.content.description)
    : activity.post?.content
      ? formatThinkpagesContentForDisplay(activity.post.content as string)
      : "";

  const rawContentText = [
    activity.content?.title,
    activity.content?.description,
    activity.post?.content,
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join("\n");

  const sportsBulletin = useMemo(
    () => parseSportsBulletin(rawContentText),
    [rawContentText]
  );

  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 shadow-sm transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06]">
      <div className="flex items-start gap-3">
        {/* Source icon — wiki uses the W logo */}
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 group-hover:scale-105",
            isWiki ? "border-teal-500/20 bg-teal-500/10" : cn(resolvedConfig.bg, "border-white/10")
          )}
        >
          {isWiki ? (
            <img src="https://cdn.simpleicons.org/wikipedia/teal" alt="Wiki" className="h-4.5 w-4.5" />
          ) : (
            <Icon className={cn("h-4.5 w-4.5", resolvedConfig.color)} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Header Row: Title on Left, Badges / Timestamp / Open Link on Right */}
          <FeedItemHeader
            activity={activity}
            resolvedConfig={resolvedConfig}
            isWiki={isWiki}
            isGrouped={isGrouped}
            sportsBulletin={sportsBulletin}
            wikiPageTitle={wikiPageTitle}
            wikiHref={wikiHref}
            displayTitle={displayTitle}
            titleHtml={titleHtml}
            externalUrl={externalUrl}
          />

          {/* Subtitle / Author Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-tight text-muted-foreground">
            {isGrouped ? (
              isWiki ? (
                <span>
                  <span className="font-semibold text-foreground">{activity._editCount}</span> edits by{" "}
                  {activity._editors.map((editor: string, idx: number) => (
                    <span key={editor}>
                      {idx > 0 && ", "}
                      <WikiAuthorPopover username={editor} />
                    </span>
                  ))}
                </span>
              ) : (
                <span>
                  <span className="font-semibold text-foreground">{activity._editCount}</span> updates by{" "}
                  <span className="font-semibold text-foreground">{activity._editors?.[0] ?? "unknown"}</span>
                </span>
              )
            ) : (
              activity.user?.name && (
                isWiki ? (
                  <span className="flex items-center gap-1">
                    <span>by</span> <WikiAuthorPopover username={activity.user.name} />
                  </span>
                ) : activity.poll && activity.user.name === "User" ? null : (
                  <span>by <span className="font-semibold text-foreground/90">{activity.user.name}</span></span>
                )
              )
            )}
          </div>

          {/* Inline Wiki Article Lead Snippet Preview */}
          {isWiki && wikiPageTitle && (
            <InlineWikiArticlePreview title={wikiPageTitle} wiki="ixwiki" />
          )}

          {/* Body Content / Poll / Sports Card / Description (non-wiki items) */}
          {!isWiki && !isGrouped && (
            activity.poll ? (
              <FeedPollWidget poll={activity.poll} />
            ) : sportsBulletin ? (
              <SportsBulletinCard data={sportsBulletin} />
            ) : descHtml ? (
              <WikiHtmlContent
                html={descHtml}
                className="pt-0.5 text-xs leading-relaxed tracking-tight text-muted-foreground/90 whitespace-pre-wrap break-words"
              />
            ) : null
          )}

          {/* Grouped sub-items expandable drawer */}
          {isGrouped && <FeedGroupedDrawer subEdits={activity._subEdits} isWiki={isWiki} />}
        </div>
      </div>
    </div>
  );
});

export function parseWikitextToHtml(wikitext: string, wikiSource: string = "ixwiki"): string {
  if (!wikitext) return "";

  let text = wikitext;

  // 1. Strip ref tags: <ref>...</ref> or <ref ... />
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref\b[^>]*\/>/gi, "");

  // 2. Strip templates: {{...}}
  text = text.replace(/\{\{[\s\S]*?\}\}/g, "");

  // 3. Convert wikitext images: [[File:name.jpg|thumb|200px|Caption]] or [[Image:name.png|...]]
  text = text.replace(/\[\[(?:File|Image):([^\]]+)\]\]/gi, (_match, content) => {
    const parts = content.split("|").map((p: string) => p.trim());
    if (parts.length === 0 || !parts[0]) return "";

    const rawFileName = parts[0];
    const imageUrl = resolveImageUrl(rawFileName, wikiSource as any) ?? getImageUrl(rawFileName);
    if (!imageUrl) return "";

    const captionParts = parts.slice(1).filter((p: string) => {
      const lower = p.toLowerCase();
      if (
        lower === "thumb" ||
        lower === "thumbnail" ||
        lower === "frame" ||
        lower === "framed" ||
        lower === "frameless" ||
        lower === "border" ||
        lower === "left" ||
        lower === "right" ||
        lower === "center" ||
        lower === "none" ||
        /^\d+px$/i.test(lower) ||
        /^upright(=[\d.]+)?$/i.test(lower) ||
        lower.startsWith("alt=") ||
        lower.startsWith("link=")
      ) {
        return false;
      }
      return true;
    });

    const caption = captionParts.join(" | ");

    return `<figure class="my-2.5 overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-md backdrop-blur-md transition-all">
      <img src="${imageUrl}" alt="${caption || rawFileName}" class="max-h-48 w-full object-cover rounded-t-xl" loading="lazy" />
      ${caption ? `<figcaption class="p-2 text-[10px] text-muted-foreground/90 font-medium tracking-tight bg-white/[0.03] border-t border-white/5 leading-tight">${caption}</figcaption>` : ""}
    </figure>`;
  });

  // 4. Convert wikitext bold+italic: '''''text'''''
  text = text.replace(/'''''((?:(?!''''')[\s\S])+)'''''/g, "<strong><em>$1</em></strong>");

  // 5. Convert wikitext bold: '''text'''
  text = text.replace(/'''((?:(?!''')[\s\S])+)'''/g, "<strong>$1</strong>");

  // 6. Convert wikitext italic: ''text''
  text = text.replace(/''((?:(?!'')[\s\S])+)''/g, "<em>$1</em>");

  // 7. Convert wikitext piped internal links: [[Target Page|Display Label]]
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_match, page, label) => {
    const route = titleToWikiOSRoute(page.trim());
    return `<a href="${route}" class="text-teal-400 font-semibold hover:underline">${label.trim()}</a>`;
  });

  // 8. Convert wikitext simple internal links: [[Target Page]]
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_match, page) => {
    const p = page.trim();
    const route = titleToWikiOSRoute(p);
    return `<a href="${route}" class="text-teal-400 font-semibold hover:underline">${p}</a>`;
  });

  // 9. Convert wikitext external links: [http://example.com Display Label]
  text = text.replace(
    /\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-teal-400 hover:underline">$2</a>'
  );

  return text.trim();
}

export function InlineWikiArticlePreview({
  title,
  wiki = "ixwiki",
}: {
  title: string;
  wiki?: "ixwiki" | "iiwiki";
}) {
  const { data: intro } = api.wiki.getIntro.useQuery(
    { title, wiki },
    { enabled: !!title, staleTime: 30 * 60_000 }
  );

  const formattedHtml = useMemo(() => {
    if (!intro?.text) return "";
    return parseWikitextToHtml(intro.text, wiki);
  }, [intro?.text, wiki]);

  if (!formattedHtml) return null;

  const wikiHref = titleToWikiOSRoute(title);

  return (
    <div className="group/preview mt-2 flex items-start gap-2.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-2.5 shadow-sm transition-all duration-150 hover:border-teal-500/35 hover:bg-teal-500/[0.08]">
      <div className="mt-0.5 h-full min-h-[2rem] w-0.5 shrink-0 rounded-full bg-teal-500/60 group-hover/preview:bg-teal-400" />
      <div className="min-w-0 flex-1">
        <WikiHtmlContent
          html={formattedHtml}
          className="line-clamp-2 text-[11px] leading-relaxed font-normal tracking-tight text-foreground/80 group-hover/preview:text-foreground [&_a]:transition-colors"
        />
      </div>
      <Link
        href={wikiHref}
        className="text-teal-400/80 hover:text-teal-300 ml-1.5 shrink-0 text-[10px] font-semibold transition-colors active:scale-95"
      >
        Read →
      </Link>
    </div>
  );
}

export function FeedExternalLink({ url }: { url: string; title?: string }) {
  const wikiMatch = url.match(/ixwiki\.com\/wiki\/([^#?]+)/);
  const forumMatch = url.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
  const link = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium tracking-tight transition-all duration-150 hover:bg-white/10 active:scale-[0.95]"
    >
      <ExternalLink className="h-3 w-3" />
      <span>Open</span>
    </a>
  );
  if (wikiMatch)
    return (
      <WikiLinkPreview title={decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")} wiki="ixwiki">
        {link}
      </WikiLinkPreview>
    );
  if (forumMatch)
    return <ForumLinkPreview threadId={parseInt(forumMatch[1]!, 10)}>{link}</ForumLinkPreview>;
  return link;
}
