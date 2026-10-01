import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { useHtmlMarkup } from "~/components/wiki-os/shared/useHtmlMarkup";
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

// HTML elements that cannot contain whitespace text nodes in React / DOM validation
const STRICT_TABLE_ELEMENTS = new Set([
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "colgroup",
  "select",
]);

const NO_MISSING_PAGES: ReadonlySet<string> = new Set();
const RED_LINK_CLASS =
  "text-destructive underline decoration-destructive/30 transition-colors hover:decoration-destructive";

/** Article title a `/wiki/...` href points at; null for namespaced (File:, Category:…) targets. */
function wikiLinkTitle(href: string): string | null {
  const path = href.slice("/wiki/".length).split(/[?#]/)[0] ?? "";
  try {
    const title = decodeURIComponent(path).replace(/_/g, " ").trim();
    return title && title.length <= 255 && !title.includes(":") ? title : null;
  } catch {
    return null;
  }
}

function collectWikiLinkTitles(root: Element): string[] {
  const titles = new Set<string>();
  root.querySelectorAll('a[href^="/wiki/"]').forEach((link) => {
    const title = wikiLinkTitle(link.getAttribute("href") ?? "");
    if (title) titles.add(title);
  });
  return Array.from(titles).slice(0, 200);
}

/** Wiki link; links to pages that do not exist render as red links. */
function renderWikiLink(
  element: HTMLElement,
  index: number,
  missing: ReadonlySet<string>
): React.ReactNode {
  const href = element.getAttribute("href") || "";
  const title = wikiLinkTitle(href);
  const isRedLink = title !== null && missing.has(title);
  const className = isRedLink
    ? RED_LINK_CLASS
    : element.className ||
      "text-tint hover:text-wiki-hover font-semibold underline transition-colors";

  return (
    <a
      key={index}
      href={href}
      className={className}
      title={isRedLink ? `${title} (page does not exist)` : undefined}
    >
      {Array.from(element.childNodes).map((child, childIdx) =>
        domNodeToReact(child, childIdx, missing)
      )}
    </a>
  );
}

function domNodeToReact(
  node: Node,
  index: number,
  missing: ReadonlySet<string> = NO_MISSING_PAGES
): React.ReactNode {
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
          className="rounded-card border-separator bg-fill-4 hover:border-separator flex items-center gap-4 border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
        >
          <div className="min-w-0 flex-1 text-left">
            <div className="mb-1 flex items-center gap-2">
              <WikiOSLogomark className="text-tint h-3.5 w-3.5 shrink-0" />
              <span className="text-eyebrow text-label-secondary">
                {source === "iiwiki" ? "IIWiki Article" : "IxWiki Article"}
              </span>
            </div>
            <h4 className="text-headline text-label truncate leading-snug">{title}</h4>
            <p className="text-footnote text-label-secondary mt-0.5 line-clamp-2 leading-normal">
              {summary}
            </p>
          </div>
          {imageUrl && (
            <img
              src={imageUrl}
              className="rounded-row border-separator h-16 w-16 border object-cover"
              alt=""
            />
          )}
        </a>
      </div>
    );
  }

  // Custom Handler: Wiki Link
  if (tagName === "a" && element.getAttribute("href")?.startsWith("/wiki/")) {
    return renderWikiLink(element, index, missing);
  }

  // Custom Handler: Hashtag Link
  if (tagName === "a" && element.getAttribute("href")?.startsWith("/hashtags/")) {
    const href = element.getAttribute("href") || "";
    const className = element.className || "text-tint hover:underline cursor-pointer font-medium";

    return (
      <Link key={index} href={ixstatesHref(href)} className={className}>
        {Array.from(element.childNodes).map((child, childIdx) =>
          domNodeToReact(child, childIdx, missing)
        )}
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
        "inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-caption font-semibold select-none transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 hover:-translate-y-0.5 border";
      if (isLeague) {
        badgeStyle +=
          "bg-yellow/6 border-yellow/20 text-yellow hover:bg-yellow/10 hover:border-yellow/30";
      } else if (isClub) {
        badgeStyle += "bg-tint/6 border-tint/20 text-tint hover:bg-tint/10 hover:border-tint/30";
      } else if (isCountry) {
        badgeStyle +=
          "bg-green/6 border-green/20 text-green hover:bg-green/10 hover:border-green/30";
      } else {
        badgeStyle += "bg-tint/10 border-tint/30 text-tint hover:bg-tint/20 hover:text-wiki-hover";
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
        {Array.from(element.childNodes).map((child, childIdx) =>
          domNodeToReact(child, childIdx, missing)
        )}
      </Link>
    );
  }

  // Filter out whitespace-only text nodes in strict table/form containers to prevent React hydration/DOM nesting errors
  const childNodes = Array.from(element.childNodes).filter((child) => {
    if (STRICT_TABLE_ELEMENTS.has(tagName) && child.nodeType === Node.TEXT_NODE) {
      return Boolean(child.textContent && child.textContent.trim().length > 0);
    }
    return true;
  });

  const children = childNodes
    .map((child, childIdx) => domNodeToReact(child, childIdx, missing))
    .filter((child) => child !== null && child !== undefined);

  const props: any = { key: index };

  if (element.className) props.className = element.className;
  if (element.getAttribute("href")) props.href = element.getAttribute("href");
  if (element.getAttribute("target")) props.target = element.getAttribute("target");
  if (element.getAttribute("rel")) props.rel = element.getAttribute("rel");
  if (element.getAttribute("src")) props.src = element.getAttribute("src");
  if (element.getAttribute("alt")) props.alt = element.getAttribute("alt");
  if (element.getAttribute("title")) props.title = element.getAttribute("title");
  if (element.getAttribute("scope")) props.scope = element.getAttribute("scope");
  if (element.getAttribute("colspan")) {
    props.colSpan = Number(element.getAttribute("colspan")) || element.getAttribute("colspan");
  }
  if (element.getAttribute("rowspan")) {
    props.rowSpan = Number(element.getAttribute("rowspan")) || element.getAttribute("rowspan");
  }

  if (element.getAttribute("style")) {
    props.style = parseStyleString(element.getAttribute("style") || "");
  }

  if (["br", "hr", "img"].includes(tagName)) {
    return React.createElement(tagName, props);
  }

  return React.createElement(tagName, props, ...children);
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
        <Link href={ixstatesHref(href)} className={badgeStyle} onClick={(e) => e.stopPropagation()}>
          {icon && <span className="text-footnote shrink-0 leading-none">{icon}</span>}
          <span>{label}</span>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="center" sideOffset={6} className="w-64 p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2 py-1">
            <Skeleton className="rounded-control-sm h-4 w-24" />
            <Skeleton className="rounded-control-sm h-3 w-40" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* League Popover content */}
            {isLeague && leagueData && (
              <div className="flex flex-col gap-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-title-3">🏆</span>
                  <div>
                    <h4 className="text-headline text-yellow">{leagueData.name}</h4>
                    <p className="text-footnote text-label-secondary capitalize">
                      {leagueData.sportPreset} · {leagueData.archetype}
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex gap-2">
                  <Link
                    href={ixstatesHref(`/myleague/${entityId}`)}
                    className="rounded-control-sm bg-yellow/10 text-caption text-yellow hover:bg-yellow/20 flex-1 py-1 text-center font-semibold"
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
                  <span
                    className="text-title-3"
                    style={{ color: teamData.color || "var(--color-warning-light)" }}
                  >
                    🛡️
                  </span>
                  <div>
                    <h4 className="text-headline text-tint">{teamData.name}</h4>
                    <p className="text-footnote text-label-secondary">
                      Stadium Cap: {teamData.stadiumCapacity}
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex gap-2">
                  <Link
                    href={ixstatesHref(`/myclub/${entityId}`)}
                    className="rounded-control-sm bg-tint/10 text-caption text-tint hover:bg-tint/20 flex-1 py-1 text-center font-semibold"
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
                  <span className="text-title-3">🌍</span>
                  <div>
                    <h4 className="text-headline text-green">
                      {(countryData as any)?.title ?? entityId}
                    </h4>
                    <p className="text-footnote text-label-secondary line-clamp-2">
                      {countryData.paragraphs?.[0] || "Explore country details."}
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex gap-2">
                  <Link
                    href={ixstatesHref(`/countries/${entityId}`)}
                    className="rounded-control-sm bg-green/10 text-caption text-green hover:bg-green/20 flex-1 py-1 text-center font-semibold"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={ixstatesHref(`/mycountry/diplomacy`)}
                    className="rounded-control-sm border-separator bg-surface-secondary text-caption text-label hover:bg-fill-3 flex-1 border py-1 text-center font-semibold"
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
                  <div className="bg-tint/10 flex h-8 w-8 items-center justify-center rounded-full">
                    <span className="text-headline text-tint">👤</span>
                  </div>
                  <div>
                    <h4 className="text-headline text-tint">@{entityId}</h4>
                    {authorData.country && (
                      <p className="text-footnote text-label-secondary">
                        From {authorData.country.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex gap-2">
                  <Link
                    href={ixstatesHref(`/dashboard`)}
                    className="rounded-control-sm bg-tint/10 text-caption text-tint hover:bg-tint/20 flex-1 py-1 text-center font-semibold"
                  >
                    View Feed
                  </Link>
                  <Link
                    href={ixstatesHref(`/messages`)}
                    className="rounded-control-sm border-separator bg-surface-secondary text-caption text-label hover:bg-fill-3 flex-1 border py-1 text-center font-semibold"
                  >
                    Message
                  </Link>
                </div>
              </div>
            )}

            {/* Fallback if no data was found or loaded */}
            {!isLoading && !leagueData && !teamData && !countryData && !authorData && (
              <div className="flex flex-col gap-2 text-left">
                <h4 className="text-caption text-label-secondary font-semibold">{label}</h4>
                <p className="text-footnote text-label-secondary">Explore page profile.</p>
                <Link
                  href={ixstatesHref(href)}
                  className="rounded-control-sm border-separator bg-surface-secondary text-caption text-label hover:bg-fill-3 mt-1 border py-1 text-center font-semibold"
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
  // the server's and the first client render's HTML: one object per string, or React 19 writes it again
  const rawMarkup = useHtmlMarkup(html);

  useEffect(() => {
    // oxlint-disable-next-line
    setIsMounted(true);
  }, []);

  const root = useMemo(() => {
    if (!isMounted || typeof window === "undefined" || !html) return null;
    try {
      const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
      return doc.body.firstElementChild;
    } catch (err) {
      console.warn("Failed to parse HTML in WikiHtmlContent:", err);
      return null;
    }
  }, [html, isMounted]);

  // One batched existence check per rendered content marks links to missing pages red.
  const linkTitles = useMemo(() => (root ? collectWikiLinkTitles(root) : []), [root]);
  const { data: missingTitles } = api.wikios.getMissingPages.useQuery(
    { titles: linkTitles },
    { enabled: linkTitles.length > 0, staleTime: 5 * 60_000, retry: false }
  );
  const missing = useMemo(
    () => (missingTitles ? new Set(missingTitles) : NO_MISSING_PAGES),
    [missingTitles]
  );

  const parsedContent = useMemo(() => {
    if (!root) return null;
    try {
      return Array.from(root.childNodes)
        .map((node, idx) => domNodeToReact(node, idx, missing))
        .filter((node) => node !== null && node !== undefined);
    } catch (err) {
      console.warn("Failed to render HTML in WikiHtmlContent:", err);
      return null;
    }
  }, [root, missing]);

  if (!isMounted || !parsedContent) {
    return <Tag className={className} dangerouslySetInnerHTML={rawMarkup} />;
  }

  return <Tag className={className}>{parsedContent}</Tag>;
}

// Re-export for backward compat
export { WikiHtmlContent as WikiContentRenderer };
