/**
 * link-graph-service.ts — WikiOS Relational Link Graph Engine
 *
 * Automatically parses [[WikiLinks]] and internal anchor tags from wikitext / HTML / AST,
 * maintains the directed graph in `wiki_links`, and delivers O(1) indexed backlink lookups.
 */

import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";
import { canonicalizeTitle, decodeTitleParam, type CanonicalTitle } from "./title";

/** Namespaces a link to which is not a link between articles: File, Category, Special, Media. */
const NON_ARTICLE_NAMESPACES: ReadonlySet<number> = new Set([6, 14, -1, -2]);

/** The canonical target of a link, or null when it does not point at an article. */
function articleTarget(rawTarget: string, source: string): CanonicalTitle | null {
  const canon = canonicalizeTitle(rawTarget, { source });
  // File, Category, Special and Media are core MediaWiki namespaces on every wiki, so another
  // wiki's links are checked against IxWiki's table for that (its own titles carry no namespace).
  const namespaceId =
    source === "ixwiki" ? canon?.namespaceId : canonicalizeTitle(rawTarget)?.namespaceId;
  return canon && !NON_ARTICLE_NAMESPACES.has(namespaceId ?? 0) ? canon : null;
}

/** A `[[Target#Section|Label]]` link as written. */
export interface WikitextLink {
  target: string;
  section?: string;
  label?: string;
}

/**
 * `[[Target#Section|Label]]` links, left to right, as `/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g`
 * would find them, in one pass. The regex backtracks over everything after each `[[` that never
 * closes, so a text of `[[a[[a[[a...` costs time quadratic in its length; here every run up to the
 * next `]`, `|` or `#` is looked up once (`stopper`) and shared by all the `[[` inside it.
 */
export function* wikitextLinks(wikitext: string): Generator<WikitextLink> {
  const stopper = (stops: string) => {
    let from = 0;
    let stop = -1;
    return (at: number): number => {
      if (at < from || at > stop) {
        from = at;
        stop = at;
        while (stop < wikitext.length && !stops.includes(wikitext[stop]!)) stop++;
      }
      return stop;
    };
  };
  const targetEnd = stopper("]|#");
  const sectionEnd = stopper("]|");
  const labelEnd = stopper("]");

  let open = wikitext.indexOf("[[");
  while (open !== -1) {
    const link = linkAt(open + 2);
    if (link) {
      yield link.link;
      open = wikitext.indexOf("[[", link.end);
    } else {
      open = wikitext.indexOf("[[", open + 1);
    }
  }

  function linkAt(start: number): { link: WikitextLink; end: number } | null {
    let at = targetEnd(start);
    if (at === start) return null;
    const link: WikitextLink = { target: wikitext.slice(start, at) };
    if (wikitext[at] === "#") {
      const sectionStart = at + 1;
      at = sectionEnd(sectionStart);
      if (at === sectionStart) return null;
      link.section = wikitext.slice(sectionStart, at);
    }
    if (wikitext[at] === "|") {
      const labelStart = at + 1;
      at = labelEnd(labelStart);
      if (at === labelStart) return null;
      link.label = wikitext.slice(labelStart, at);
    }
    return wikitext.startsWith("]]", at) ? { link, end: at + 2 } : null;
  }
}

export interface ExtractedLink {
  targetSlug: string;
  /** Canonical title of the target: what `WikiArticle.title` holds when the page exists. */
  targetTitle: string;
  anchorText?: string;
  sectionAnchor?: string;
  isExternal: boolean;
}

/** Record a link to `target` once per `target#section`: the first anchor text wins. */
function addLink(
  linkMap: Map<string, ExtractedLink>,
  target: CanonicalTitle,
  section: string | undefined,
  anchorText: string
): void {
  const key = `${target.slug}#${section || ""}`;
  if (linkMap.has(key)) return;
  linkMap.set(key, {
    targetSlug: target.slug,
    targetTitle: target.title,
    anchorText,
    sectionAnchor: section || undefined,
    isExternal: false,
  });
}

export class LinkGraphService {
  /**
   * Extract all internal and external link references from content
   */
  static extractLinks(wikitext: string, html?: string, source = "ixwiki"): ExtractedLink[] {
    const linkMap = new Map<string, ExtractedLink>();

    // 1. Parse Wikitext internal links: [[Target|Label]] or [[Target#Section|Label]]
    for (const link of wikitextLinks(wikitext)) {
      const rawTarget = link.target.trim();
      const target = rawTarget ? articleTarget(rawTarget, source) : null;
      if (target) addLink(linkMap, target, link.section?.trim(), link.label?.trim() || rawTarget);
    }

    // 2. Parse HTML anchors: <a href="/wiki/Target">
    if (html) {
      const htmlRegex =
        /<a\s+[^>]*href=["'](?:\/wiki\/|\/w\/)([^"#'?]+)(?:#([^"']+))?["'][^>]*>(.*?)<\/a>/gi;
      for (const match of html.matchAll(htmlRegex)) {
        const rawTarget = match[1]?.trim();
        const target = rawTarget ? articleTarget(decodeTitleParam(rawTarget), source) : null;
        if (target) {
          const label = match[3]?.replace(/<[^>]*>/g, "").trim();
          addLink(linkMap, target, match[2]?.trim(), label || target.slug);
        }
      }
    }

    return Array.from(linkMap.values());
  }

  /**
   * Synchronize the directed link graph for an article in PostgreSQL
   */
  static async syncArticleLinks(
    articleId: string,
    wikitext: string,
    html?: string,
    source = "ixwiki"
  ): Promise<number> {
    const extracted = this.extractLinks(wikitext, html, source);

    // Resolve which target articles currently exist in PostgreSQL, by canonical title
    const targetTitles = [...new Set(extracted.map((l) => l.targetTitle))];

    const existingTargets: Array<{ id: string; title: string }> =
      targetTitles.length > 0
        ? await db.wikiArticle.findMany({
            where: { source, status: "PUBLISHED", title: { in: targetTitles } },
            select: { id: true, title: true },
          })
        : [];

    const targetMap = new Map(existingTargets.map((t) => [t.title, t.id]));

    try {
      // Transactionally update the link graph for this article
      await db.$transaction(async (tx) => {
        // Remove old outgoing links
        await tx.wikiLink.deleteMany({
          where: { sourceArticleId: articleId },
        });

        // Insert new links
        if (extracted.length > 0) {
          await tx.wikiLink.createMany({
            data: extracted.map((link) => ({
              sourceArticleId: articleId,
              targetSlug: link.targetSlug,
              targetArticleId: targetMap.get(link.targetTitle) ?? null,
              anchorText: link.anchorText ?? null,
              sectionAnchor: link.sectionAnchor ?? null,
              isExternal: link.isExternal,
            })),
            skipDuplicates: true,
          });
        }
      });
    } catch {
      // Best-effort if table not migrated or transient DB error
    }

    return extracted.length;
  }

  /**
   * O(1) Backlinks query ("What Links Here")
   */
  static async getBacklinks(
    targetSlug: string,
    source = "ixwiki",
    limit = 50
  ): Promise<Array<{ id: string; slug: string; title: string; anchorText: string | null }>> {
    const normalized = toArticleSlug(targetSlug);

    try {
      const links = await db.wikiLink.findMany({
        where: {
          targetSlug: normalized,
          sourceArticle: { source, status: "PUBLISHED" },
        },
        include: {
          sourceArticle: {
            select: { id: true, title: true },
          },
        },
        take: limit,
      });

      return links.map((l) => ({
        id: l.sourceArticle?.id ?? "",
        slug: toArticleSlug(l.sourceArticle?.title ?? ""),
        title: l.sourceArticle?.title ?? "",
        anchorText: l.anchorText ?? null,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Query Outbound Links from an article
   */
  static async getOutboundLinks(
    sourceSlug: string,
    source = "ixwiki"
  ): Promise<Array<{ targetSlug: string; anchorText: string | null; isBroken: boolean }>> {
    const normalized = toArticleSlug(sourceSlug);

    try {
      const article = await db.wikiArticle.findFirst({
        where: {
          source,
          OR: [
            { title: { equals: sourceSlug.replace(/_/g, " "), mode: "insensitive" } },
            { title: { equals: normalized, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      if (!article) return [];

      const links = await db.wikiLink.findMany({
        where: { sourceArticleId: article.id },
        select: { targetSlug: true, anchorText: true, targetArticleId: true },
      });

      return links.map((l) => ({
        targetSlug: l.targetSlug,
        anchorText: l.anchorText,
        isBroken: l.targetArticleId === null,
      }));
    } catch {
      return [];
    }
  }
}
