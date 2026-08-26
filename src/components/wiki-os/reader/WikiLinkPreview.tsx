import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  HoverCardArrow,
} from "~/components/ui/hover-card";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";

// ──────────────────────────────────────────────
// WikiLinkPreview — for React element wrapping
// ──────────────────────────────────────────────

interface WikiLinkPreviewProps {
  title: string;
  wiki?: "ixwiki" | "iiwiki";
  children: React.ReactNode;
}

export function WikiLinkPreview({ title, wiki = "ixwiki", children }: WikiLinkPreviewProps) {
  // Prefetch intro for instant tooltip via global provider
  const utils = api.useUtils();
  useEffect(() => {
    if (title) void utils.wikios.getIntro.prefetch({ title, wiki });
  }, [title, wiki, utils]);

  // Just render children — global provider handles the tooltip
  return <>{children}</>;
}

// ──────────────────────────────────────────────
// ForumLinkPreview — for React element wrapping
// ──────────────────────────────────────────────

interface ForumLinkPreviewProps {
  threadId: number;
  children: React.ReactNode;
}

export function ForumLinkPreview({ threadId, children }: ForumLinkPreviewProps) {
  // Prefetch thread data for instant tooltip via global provider
  const utils = api.useUtils();
  useEffect(() => {
    if (threadId > 0) void utils.wikios.getForumThreadPreview.prefetch({ threadId });
  }, [threadId, utils]);

  return <>{children}</>;
}

// ──────────────────────────────────────────────
// WikiHtmlContent — renders raw HTML safely
// Tooltips are handled by the global provider
// ──────────────────────────────────────────────

interface WikiHtmlContentProps {
  html: string;
  className?: string;
  /** HTML tag to use for wrapper */
  as?: "div" | "p" | "span";
}

const parseStyleString = (styleStr: string): Record<string, string> => {
  const styles: Record<string, string> = {};
  styleStr.split(";").forEach((pair) => {
    const [key, val] = pair.split(":");
    if (key && val) {
      const camelKey = key.trim().replace(/-./g, (c) => c.substring(1).toUpperCase());
      styles[camelKey] = val.trim();
    }
  });
  return styles;
};

function domNodeToReact(node: Node, index: number): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  // Custom Handler: Wiki Card Embed
  if (tagName === "div" && element.getAttribute("data-wikiembed") === "true") {
    const title = element.getAttribute("data-title") || "";
    const summary = element.getAttribute("data-summary") || "";
    const imageUrl = element.getAttribute("data-imageurl") || "";
    const source = element.getAttribute("data-source") || "ixwiki";

    return (
      <div key={index} className="my-3 select-none">
        <a
          href={
            source === "iiwiki"
              ? `https://iiwiki.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
              : `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-slate-500/[0.03] p-3.5 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
        >
          <div className="min-w-0 flex-1 text-left">
            <div className="mb-1 flex items-center gap-1.5">
              <WikiOSLogomark className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                {source === "iiwiki" ? "IIWiki Article" : "IxWiki Article"}
              </span>
            </div>
            <h4 className="truncate text-sm leading-snug font-semibold text-slate-800 dark:text-slate-200">
              {title}
            </h4>
            <p className="mt-0.5 line-clamp-2 text-xs leading-normal text-slate-500 dark:text-slate-400">
              {summary}
            </p>
          </div>
          {imageUrl && (
            <img
              src={imageUrl}
              className="h-16 w-16 rounded-xl border border-slate-200 object-cover dark:border-white/10"
              alt=""
            />
          )}
        </a>
      </div>
    );
  }

  // Custom Handler: Wiki Link
  if (tagName === "a" && element.getAttribute("href")?.startsWith("/wiki/")) {
    const href = element.getAttribute("href") || "";
    const className =
      element.className ||
      "text-purple-600 dark:text-purple-400 font-semibold underline hover:text-purple-700 dark:hover:text-purple-300 transition-colors";

    return (
      <a key={index} href={href} className={className}>
        {Array.from(element.childNodes).map((child, childIdx) => domNodeToReact(child, childIdx))}
      </a>
    );
  }

  // Custom Handler: Hashtag Link
  if (tagName === "a" && element.getAttribute("href")?.startsWith("/hashtags/")) {
    const href = element.getAttribute("href") || "";
    const className =
      element.className || "text-blue-500 hover:underline cursor-pointer font-medium";

    return (
      <Link key={index} href={withBasePath(href)} className={className}>
        {Array.from(element.childNodes).map((child, childIdx) => domNodeToReact(child, childIdx))}
      </Link>
    );
  }

  // Custom Handler: Entity Mentions (myleague, myclub, countries, thinkpages)
  if (tagName === "a" && element.getAttribute("href")) {
    const href = element.getAttribute("href") || "";
    const isLeague = href.includes("/myleague/");
    const isClub = href.includes("/myclub/");
    const isCountry = href.includes("/countries/");
    const isThinkpagesUser = href.includes("/thinkpages/") || href.includes("/dashboard/");

    if (isLeague || isClub || isCountry || isThinkpagesUser) {
      let label = element.textContent || "";

      // Strip leading @ for leagues, clubs, and countries
      if (!isThinkpagesUser && label.startsWith("@")) {
        label = label.substring(1);
      }

      // Ensure leading @ for thinkpages users
      if (isThinkpagesUser && !label.startsWith("@")) {
        label = `@${label}`;
      }

      const icon = getEntityIcon(label, isLeague, isClub, isCountry);

      // Determine style classes: Minimalist Glass Pills with default light and dark mode classes
      let badgeStyle =
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold select-none transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5 backdrop-blur-[2px] border ";
      if (isLeague) {
        badgeStyle +=
          "bg-amber-600/[0.06] border-amber-600/20 text-amber-700 hover:bg-amber-600/[0.1] hover:border-amber-600/30 dark:bg-amber-500/[0.04] dark:border-amber-500/15 dark:text-amber-400/90 dark:hover:bg-amber-500/[0.08] dark:hover:border-amber-500/25";
      } else if (isClub) {
        badgeStyle +=
          "bg-blue-600/[0.06] border-blue-600/20 text-blue-700 hover:bg-blue-600/[0.1] hover:border-blue-600/30 dark:bg-blue-500/[0.04] dark:border-blue-500/15 dark:text-blue-400/90 dark:hover:bg-blue-500/[0.08] dark:hover:border-blue-500/25";
      } else if (isCountry) {
        badgeStyle +=
          "bg-emerald-600/[0.06] border-emerald-600/20 text-emerald-700 hover:bg-emerald-600/[0.1] hover:border-emerald-600/30 dark:bg-emerald-500/[0.04] dark:border-emerald-500/15 dark:text-emerald-400/90 dark:hover:bg-emerald-500/[0.08] dark:hover:border-emerald-500/25";
      } else {
        badgeStyle +=
          "bg-purple-600/[0.06] border-purple-600/20 text-purple-700 hover:bg-purple-600/[0.1] hover:border-purple-600/30 dark:bg-purple-500/[0.04] dark:border-purple-500/15 dark:text-purple-400/90 dark:hover:bg-purple-500/[0.08] dark:hover:border-purple-500/25";
      }

      return (
        <MentionPopover
          key={index}
          href={href}
          label={label}
          badgeStyle={badgeStyle}
          icon={icon || undefined}
        />
      );
    }
  }

  // Custom Handler: General Relative Link (intercept full page reloads for client routes)
  if (
    tagName === "a" &&
    element.getAttribute("href")?.startsWith("/") &&
    !element.getAttribute("target")
  ) {
    const href = element.getAttribute("href") || "";
    const cleanHref = href.replace(/^\/projects\/ixstates/, "");
    return (
      <Link key={index} href={withBasePath(cleanHref)} className={element.className}>
        {Array.from(element.childNodes).map((child, childIdx) => domNodeToReact(child, childIdx))}
      </Link>
    );
  }

  // Standard HTML elements mapping
  const children = Array.from(element.childNodes).map((child, childIdx) =>
    domNodeToReact(child, childIdx)
  );
  const props: any = { key: index };

  if (element.className) props.className = element.className;
  if (element.getAttribute("href")) props.href = element.getAttribute("href");
  if (element.getAttribute("target")) props.target = element.getAttribute("target");
  if (element.getAttribute("rel")) props.rel = element.getAttribute("rel");
  if (element.getAttribute("src")) props.src = element.getAttribute("src");
  if (element.getAttribute("alt")) props.alt = element.getAttribute("alt");

  if (element.getAttribute("style")) {
    props.style = parseStyleString(element.getAttribute("style") || "");
  }

  if (["br", "hr", "img"].includes(tagName)) {
    return React.createElement(tagName, props);
  }

  return React.createElement(tagName, props, children);
}

function getEntityIcon(
  label: string,
  isLeague: boolean,
  isClub: boolean,
  isCountry: boolean
): string {
  const lower = label.toLowerCase();
  if (isLeague) {
    if (lower.includes("hockey")) return "🏒";
    if (lower.includes("basketball")) return "🏀";
    if (lower.includes("football") || lower.includes("gridiron")) return "🏈";
    if (lower.includes("baseball")) return "⚾";
    if (lower.includes("f1") || lower.includes("racing") || lower.includes("motorsport"))
      return "🏎️";
    if (lower.includes("boxing") || lower.includes("fight")) return "🥊";
    if (lower.includes("soccer") || lower.includes("football")) return "⚽";
    return "🏆";
  }
  if (isClub) {
    if (lower.includes("hockey")) return "🏒";
    if (lower.includes("basketball")) return "🏀";
    if (lower.includes("football") || lower.includes("gridiron")) return "🏈";
    if (lower.includes("baseball")) return "⚾";
    if (lower.includes("f1") || lower.includes("racing") || lower.includes("motorsport"))
      return "🏎️";
    if (lower.includes("boxing") || lower.includes("fight")) return "🥊";
    if (
      lower.includes("soccer") ||
      lower.includes("football") ||
      lower.includes("fc") ||
      lower.includes("sc")
    )
      return "⚽";
    return "🛡️";
  }
  if (isCountry) {
    return "🌐";
  }
  return "";
}

export function MentionPopover({
  href,
  label,
  badgeStyle,
  icon,
}: {
  href: string;
  label: string;
  badgeStyle: string;
  icon?: string;
}) {
  const [open, setOpen] = useState(false);

  const isLeague = href.includes("/myleague/");
  const isClub = href.includes("/myclub/");
  const isCountry = href.includes("/countries/");
  const isUser = href.includes("/thinkpages/") || href.includes("/dashboard/");

  // Extract ID or Slug
  const matchId = href.match(/\/(?:myleague|myclub|countries|thinkpages\/u|u)\/([a-zA-Z0-9_-]+)/);
  const entityId = matchId ? matchId[1]! : "";

  // Query details dynamically depending on the entity type
  const { data: leagueData, isLoading: leagueLoading } = api.sports.getLeague.useQuery(
    { id: entityId },
    { enabled: open && isLeague }
  );

  const { data: teamData, isLoading: teamLoading } = api.sports.getTeam.useQuery(
    { id: entityId },
    { enabled: open && isClub }
  );

  const { data: countryData, isLoading: countryLoading } = api.countries.getWikiRichIntro.useQuery(
    { countryName: entityId },
    { enabled: open && isCountry }
  );

  const { data: authorData, isLoading: authorLoading } = api.users.resolveWikiAuthor.useQuery(
    { wikiUsername: entityId },
    { enabled: open && isUser }
  );

  const isLoading = leagueLoading || teamLoading || countryLoading || authorLoading;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link href={withBasePath(href)} className={badgeStyle} onClick={(e) => e.stopPropagation()}>
          {icon && <span className="shrink-0 text-[12px] leading-none">{icon}</span>}
          <span>{label}</span>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-64 p-4"
      >
          {isLoading ? (
            <div className="flex flex-col gap-2 py-1">
              <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-white/10" />
              <div className="h-3 w-40 animate-pulse rounded bg-neutral-100 dark:bg-white/5" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* League Popover content */}
              {isLeague && leagueData && (
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <div>
                      <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {leagueData.name}
                      </h4>
                      <p className="text-[10px] text-neutral-500 capitalize dark:text-slate-400">
                        {leagueData.sportPreset} · {leagueData.archetype}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Link
                      href={withBasePath(`/myleague/${entityId}`)}
                      className="flex-1 rounded bg-amber-500/10 py-1 text-center text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/30"
                    >
                      View Workspace
                    </Link>
                  </div>
                </div>
              )}

              {/* Club/Team Popover content */}
              {isClub && teamData && (
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" style={{ color: teamData.color || "var(--color-warning-light)" }}>
                      🛡️
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        {teamData.name}
                      </h4>
                      <p className="text-[10px] text-neutral-500 dark:text-slate-400">
                        Stadium Cap: {teamData.stadiumCapacity}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Link
                      href={withBasePath(`/myclub/${entityId}`)}
                      className="flex-1 rounded bg-blue-500/10 py-1 text-center text-xs font-semibold text-blue-700 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-200 dark:hover:bg-blue-500/30"
                    >
                      View Roster & Stats
                    </Link>
                  </div>
                </div>
              )}

              {/* Country Popover content */}
              {isCountry && countryData && (
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌍</span>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        {(countryData as any)?.title ?? entityId}
                      </h4>
                      <p className="line-clamp-2 text-[10px] text-neutral-500 dark:text-slate-400">
                        {countryData.paragraphs?.[0] || "Explore country details."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Link
                      href={withBasePath(`/countries/${entityId}`)}
                      className="flex-1 rounded bg-emerald-500/10 py-1 text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30"
                    >
                      View Profile
                    </Link>
                    <Link
                      href={withBasePath(`/mycountry/diplomacy`)}
                      className="flex-1 rounded border border-neutral-200 bg-neutral-100 py-1 text-center text-xs font-semibold text-neutral-700 hover:bg-neutral-200 dark:border-transparent dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Open Embassy
                    </Link>
                  </div>
                </div>
              )}

              {/* ThinkPages User / Account Popover content */}
              {isUser && authorData && (
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10">
                      <span className="text-sm font-bold text-purple-600 dark:text-purple-300">
                        👤
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300">
                        @{entityId}
                      </h4>
                      {authorData.country && (
                        <p className="text-[10px] text-neutral-500 dark:text-slate-400">
                          From {authorData.country.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Link
                      href={withBasePath(`/dashboard`)}
                      className="flex-1 rounded bg-purple-500/10 py-1 text-center text-xs font-semibold text-purple-700 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-200 dark:hover:bg-purple-500/30"
                    >
                      View Feed
                    </Link>
                    <Link
                      href={withBasePath(`/messages`)}
                      className="flex-1 rounded border border-neutral-200 bg-neutral-100 py-1 text-center text-xs font-semibold text-neutral-700 hover:bg-neutral-200 dark:border-transparent dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Message
                    </Link>
                  </div>
                </div>
              )}

              {/* Fallback if no data was found or loaded */}
              {!isLoading && !leagueData && !teamData && !countryData && !authorData && (
                <div className="flex flex-col gap-2 text-left">
                  <h4 className="text-xs font-bold text-neutral-600 dark:text-slate-300">
                    {label}
                  </h4>
                  <p className="text-[10px] text-neutral-500 dark:text-slate-400">
                    Explore page profile.
                  </p>
                  <Link
                    href={withBasePath(href)}
                    className="mt-1 rounded border border-neutral-200 bg-neutral-100 py-1 text-center text-xs font-semibold text-neutral-700 hover:bg-neutral-200 dark:border-transparent dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Go to Page
                  </Link>
                </div>
              )}
            </div>
          )}
          <HoverCardArrow className="fill-popover" />
        </HoverCardContent>
    </HoverCard>
  );
}

export function WikiHtmlContent({ html, className = "", as: Tag = "div" }: WikiHtmlContentProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setIsMounted(true);
  }, []);

  const parsedContent = useMemo(() => {
    if (!isMounted || typeof window === "undefined" || !html) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
      const root = doc.body.firstElementChild;
      if (!root) return null;
      return Array.from(root.childNodes).map((node, idx) => domNodeToReact(node, idx));
    } catch (err) {
      console.warn("Failed to parse HTML in WikiHtmlContent:", err);
      return null;
    }
  }, [html, isMounted]);

  if (!isMounted || !parsedContent) {
    return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <Tag className={className}>{parsedContent}</Tag>;
}

// Re-export for backward compat
export { WikiHtmlContent as WikiContentRenderer };
