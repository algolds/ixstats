import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { useHtmlMarkup } from "~/components/wiki-os/shared/useHtmlMarkup";
import { cn } from "~/lib/utils";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  HoverCardArrow,
} from "~/components/ui/hover-card";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";

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

const renderChildren = (element: HTMLElement, missing: ReadonlySet<string>) =>
  Array.from(element.childNodes).map((child, childIdx) => domNodeToReact(child, childIdx, missing));

/** Card for a `data-wikiembed` placeholder. */
function renderWikiEmbed(element: HTMLElement, index: number): React.ReactNode {
  const title = element.getAttribute("data-title") || "";
  const summary = element.getAttribute("data-summary") || "";
  const imageUrl = element.getAttribute("data-imageurl") || "";
  const isIiwiki = element.getAttribute("data-source") === "iiwiki";
  const path = `/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  return (
    <div key={index} className="my-3 select-none">
      <a
        href={isIiwiki ? `https://iiwiki.com${path}` : path}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-card border-separator bg-fill-4 hover:border-separator flex items-center gap-4 border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200"
      >
        <div className="min-w-0 flex-1 text-left">
          <div className="mb-1 flex items-center gap-2">
            <WikiOSLogomark className="text-tint h-3.5 w-3.5 shrink-0" />
            <span className="text-eyebrow text-label-secondary">
              {isIiwiki ? "IIWiki Article" : "IxWiki Article"}
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

/** Which kind(s) of game entity a link points at. */
function entityKinds(href: string) {
  return {
    isLeague: href.includes("/myleague/"),
    isClub: href.includes("/myclub/"),
    isCountry: href.includes("/countries/"),
    isUser: href.includes("/thinkpages/") || href.includes("/dashboard/"),
  };
}

const BADGE_BASE =
  "inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-caption font-semibold select-none transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 hover:-translate-y-0.5 border";

// Minimalist glass pills, joined to BADGE_BASE with cn().
const BADGE_TONES = {
  league: "bg-yellow/6 border-yellow/20 text-yellow hover:bg-yellow/10 hover:border-yellow/30",
  club: "bg-tint/6 border-tint/20 text-tint hover:bg-tint/10 hover:border-tint/30",
  country: "bg-green/6 border-green/20 text-green hover:bg-green/10 hover:border-green/30",
  user: "bg-tint/10 border-tint/30 text-tint hover:bg-tint/20 hover:text-wiki-hover",
};

/** Entity mention (league, club, country, ThinkPages user) as a pill with a hover profile card. */
function renderEntityMention(element: HTMLElement, href: string, index: number): React.ReactNode {
  const { isLeague, isClub, isCountry, isUser } = entityKinds(href);
  let label = element.textContent || "";
  if (isUser) {
    if (!label.startsWith("@")) label = `@${label}`;
  } else if (label.startsWith("@")) {
    label = label.substring(1);
  }
  const tone = isLeague ? "league" : isClub ? "club" : isCountry ? "country" : "user";

  return (
    <MentionPopover
      key={index}
      href={href}
      label={label}
      badgeStyle={cn(BADGE_BASE, BADGE_TONES[tone])}
      icon={getEntityIcon(label, isLeague, isClub, isCountry) || undefined}
    />
  );
}

const PASSTHROUGH_ATTRS = ["href", "target", "rel", "src", "alt", "title", "scope"];

function elementProps(
  element: HTMLElement,
  index: number
): React.Attributes & Record<string, unknown> {
  const props: React.Attributes & Record<string, unknown> = { key: index };
  if (element.className) props.className = element.className;
  for (const attr of PASSTHROUGH_ATTRS) {
    const value = element.getAttribute(attr);
    if (value) props[attr] = value;
  }
  for (const [attr, prop] of [
    ["colspan", "colSpan"],
    ["rowspan", "rowSpan"],
  ] as const) {
    const value = element.getAttribute(attr);
    if (value) props[prop] = Number(value) || value;
  }
  const style = element.getAttribute("style");
  if (style) props.style = parseStyleString(style);
  return props;
}

function domNodeToReact(
  node: Node,
  index: number,
  missing: ReadonlySet<string> = NO_MISSING_PAGES
): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const href = element.getAttribute("href") || "";

  if (tagName === "div" && element.getAttribute("data-wikiembed") === "true") {
    return renderWikiEmbed(element, index);
  }

  if (tagName === "a") {
    if (href.startsWith("/wiki/")) return renderWikiLink(element, index, missing);

    if (href.startsWith("/hashtags/")) {
      return (
        <Link
          key={index}
          href={ixstatesHref(href)}
          className={element.className || "text-tint cursor-pointer font-medium hover:underline"}
        >
          {renderChildren(element, missing)}
        </Link>
      );
    }

    if (Object.values(entityKinds(href)).some(Boolean)) {
      return renderEntityMention(element, href, index);
    }

    // General relative link: intercept full page reloads for client routes
    if (href.startsWith("/") && !element.getAttribute("target")) {
      return (
        <Link
          key={index}
          href={ixstatesHref(href.replace(/^\/projects\/ixstates/, ""))}
          className={element.className}
        >
          {renderChildren(element, missing)}
        </Link>
      );
    }
  }

  // Whitespace-only text nodes inside strict table/form containers trip React hydration/DOM nesting
  const dropWhitespaceText = STRICT_TABLE_ELEMENTS.has(tagName);
  const children = Array.from(element.childNodes)
    .filter(
      (child) =>
        !dropWhitespaceText || child.nodeType !== Node.TEXT_NODE || child.textContent?.trim()
    )
    .map((child, childIdx) => domNodeToReact(child, childIdx, missing))
    .filter((child) => child !== null && child !== undefined);

  const props = elementProps(element, index);
  return ["br", "hr", "img"].includes(tagName)
    ? React.createElement(tagName, props)
    : React.createElement(tagName, props, ...children);
}

const SPORT_ICONS: ReadonlyArray<[keywords: string[], icon: string]> = [
  [["hockey"], "🏒"],
  [["basketball"], "🏀"],
  [["football", "gridiron"], "🏈"],
  [["baseball"], "⚾"],
  [["f1", "racing", "motorsport"], "🏎️"],
  [["boxing", "fight"], "🥊"],
];

function getEntityIcon(
  label: string,
  isLeague: boolean,
  isClub: boolean,
  isCountry: boolean
): string {
  if (isCountry && !isLeague && !isClub) return "🌐";
  if (!isLeague && !isClub) return "";

  const lower = label.toLowerCase();
  const sport = SPORT_ICONS.find(([keywords]) => keywords.some((k) => lower.includes(k)));
  if (sport) return sport[1];
  if (isLeague) return lower.includes("soccer") ? "⚽" : "🏆";
  return ["soccer", "fc", "sc"].some((k) => lower.includes(k)) ? "⚽" : "🛡️";
}

const ACTION_TONES = {
  yellow: "bg-yellow/10 text-yellow hover:bg-yellow/20",
  tint: "bg-tint/10 text-tint hover:bg-tint/20",
  green: "bg-green/10 text-green hover:bg-green/20",
  neutral: "border border-separator bg-surface-secondary text-label hover:bg-fill-3",
};

interface PopoverCardProps {
  leading: React.ReactNode;
  title: React.ReactNode;
  titleClass: string;
  subtitle?: React.ReactNode;
  subtitleClass?: string;
  /** Each `href` is already an IxStates link (ixstatesHref). */
  actions: Array<{ href: string; label: string; tone: keyof typeof ACTION_TONES }>;
}

/** Profile summary inside a mention's hover card: leading glyph, title, subtitle and link buttons. */
function PopoverCard({
  leading,
  title,
  titleClass,
  subtitle,
  subtitleClass = "text-footnote text-label-secondary",
  actions,
}: PopoverCardProps) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <div className="flex items-center gap-2">
        {leading}
        <div>
          <h4 className={`text-headline ${titleClass}`}>{title}</h4>
          {subtitle && <p className={subtitleClass}>{subtitle}</p>}
        </div>
      </div>
      <div className="mt-1 flex gap-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`rounded-control-sm text-caption flex-1 py-1 text-center font-semibold ${ACTION_TONES[action.tone]}`}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Loads the profile behind a mention link, but only once its hover card is open. */
function useMentionProfile(open: boolean, href: string) {
  const { isLeague, isClub, isCountry, isUser } = entityKinds(href);
  const entityId =
    /\/(?:myleague|myclub|countries|thinkpages\/u|u)\/([a-zA-Z0-9_-]+)/.exec(href)?.[1] ?? "";

  const league = api.sports.getLeague.useQuery({ id: entityId }, { enabled: open && isLeague });
  const team = api.sports.getTeam.useQuery({ id: entityId }, { enabled: open && isClub });
  const country = api.countries.getWikiRichIntro.useQuery(
    { countryName: entityId },
    { enabled: open && isCountry }
  );
  const author = api.users.resolveWikiAuthor.useQuery(
    { wikiUsername: entityId },
    { enabled: open && isUser }
  );

  return {
    entityId,
    isLoading: league.isLoading || team.isLoading || country.isLoading || author.isLoading,
    leagueData: league.data,
    teamData: team.data,
    countryData: country.data,
    authorData: author.data,
  };
}

function MentionProfile({
  href,
  label,
  profile: { entityId, leagueData, teamData, countryData, authorData },
}: {
  href: string;
  label: string;
  profile: ReturnType<typeof useMentionProfile>;
}) {
  const { isLeague, isClub, isCountry, isUser } = entityKinds(href);

  return (
    <div className="flex flex-col gap-3">
      {isLeague && leagueData && (
        <PopoverCard
          leading={<span className="text-title-3">🏆</span>}
          title={leagueData.name}
          titleClass="text-yellow"
          subtitle={`${leagueData.sportPreset} · ${leagueData.archetype}`}
          subtitleClass="text-footnote text-label-secondary capitalize"
          actions={[
            {
              href: ixstatesHref(`/myleague/${entityId}`),
              label: "View workspace",
              tone: "yellow",
            },
          ]}
        />
      )}

      {isClub && teamData && (
        <PopoverCard
          leading={
            <span
              className="text-title-3"
              style={{ color: teamData.color || "var(--color-warning-light)" }}
            >
              🛡️
            </span>
          }
          title={teamData.name}
          titleClass="text-tint"
          subtitle={`Stadium Cap: ${teamData.stadiumCapacity}`}
          actions={[
            {
              href: ixstatesHref(`/myclub/${entityId}`),
              label: "View roster & stats",
              tone: "tint",
            },
          ]}
        />
      )}

      {isCountry && countryData && (
        <PopoverCard
          leading={<span className="text-title-3">🌍</span>}
          title={(countryData as any)?.title ?? entityId}
          titleClass="text-green"
          subtitle={countryData.paragraphs?.[0] || "Explore country details."}
          subtitleClass="text-footnote text-label-secondary line-clamp-2"
          actions={[
            { href: ixstatesHref(`/countries/${entityId}`), label: "View profile", tone: "green" },
            { href: ixstatesHref("/mycountry/diplomacy"), label: "Open embassy", tone: "neutral" },
          ]}
        />
      )}

      {isUser && authorData && (
        <PopoverCard
          leading={
            <div className="bg-tint/10 flex h-8 w-8 items-center justify-center rounded-full">
              <span className="text-headline text-tint">👤</span>
            </div>
          }
          title={`@${entityId}`}
          titleClass="text-tint"
          subtitle={authorData.country && `From ${authorData.country.name}`}
          actions={[
            { href: ixstatesHref("/dashboard"), label: "View feed", tone: "tint" },
            { href: ixstatesHref("/messages"), label: "Message", tone: "neutral" },
          ]}
        />
      )}

      {/* Fallback if no data was found or loaded */}
      {!leagueData && !teamData && !countryData && !authorData && (
        <div className="flex flex-col gap-2 text-left">
          <h4 className="text-caption text-label-secondary font-semibold">{label}</h4>
          <p className="text-footnote text-label-secondary">Explore page profile.</p>
          <Link
            href={ixstatesHref(href)}
            className="rounded-control-sm border-separator bg-surface-secondary text-caption text-label hover:bg-fill-3 mt-1 border py-1 text-center font-semibold"
          >
            Go to page
          </Link>
        </div>
      )}
    </div>
  );
}

function MentionPopover({
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
  const profile = useMentionProfile(open, href);

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link href={ixstatesHref(href)} className={badgeStyle} onClick={(e) => e.stopPropagation()}>
          {icon && <span className="text-footnote shrink-0 leading-none">{icon}</span>}
          <span>{label}</span>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="center" sideOffset={6} className="w-64 p-4">
        {profile.isLoading ? (
          <div className="flex flex-col gap-2 py-1">
            <Skeleton className="rounded-control-sm h-4 w-24" />
            <Skeleton className="rounded-control-sm h-3 w-40" />
          </div>
        ) : (
          <MentionProfile href={href} label={label} profile={profile} />
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
