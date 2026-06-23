import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Tooltip } from "~/components/ui/tooltip-card";

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
    if (title) void utils.wiki.getIntro.prefetch({ title, wiki });
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
    if (threadId > 0) void utils.wiki.getForumThreadPreview.prefetch({ threadId });
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
              <img
                src="https://cdn.simpleicons.org/wikipedia/1d4e89"
                className="h-3 w-3 dark:hidden"
                alt=""
              />
              <img
                src="https://cdn.simpleicons.org/wikipedia/38bdf8"
                className="hidden h-3 w-3 dark:block"
                alt=""
              />
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
      element.className ||
      "text-blue-500 hover:underline cursor-pointer font-medium";

    return (
      <Link key={index} href={withBasePath(href)} className={className}>
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

export function WikiHtmlContent({ html, className = "", as: Tag = "div" }: WikiHtmlContentProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
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
