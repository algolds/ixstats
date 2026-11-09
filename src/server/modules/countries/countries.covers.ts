/**
 * The wiki articles that may picture each Factbook block, in priority order, for one country
 * (rules in `~/lib/country/cover-topics`). Two exact-title reads: the domain articles with their
 * wikitext (for their {{Main}} pages), then those Main pages plus the capital and largest city.
 */
import type { PrismaClient } from "@prisma/client";
import {
  cleanLeadImage,
  coverDomainTitles,
  coverTitleOrder,
  extractMainTitles,
  type CoverBlock,
  type CoverTopics,
} from "~/lib/country/cover-topics";

export interface CoverArticle {
  title: string;
  slug: string;
  summary: string | null;
  imageUrl: string | null;
  readingTime: number | null;
}

export type CoverArticles = Record<CoverBlock, CoverArticle[]>;

const PUBLISHED = { namespace: 0, status: "PUBLISHED" as const };
const ARTICLE = { title: true, slug: true, summary: true, leadImageUrl: true, readingTime: true };

export async function loadCoverArticles(
  db: Pick<PrismaClient, "wikiArticle">,
  name: string,
  topics: CoverTopics
): Promise<CoverArticles> {
  const domain = Object.values(coverDomainTitles(name, topics.legislature)).flat();
  const domainRows = await db.wikiArticle.findMany({
    where: { ...PUBLISHED, title: { in: domain, mode: "insensitive" } },
    select: { ...ARTICLE, wikitext: true },
  });
  const mains = new Map(
    domainRows.map((r) => [r.title.toLowerCase(), extractMainTitles(r.wikitext)])
  );
  const order = coverTitleOrder(name, topics, mains);

  const known = new Set(domainRows.map((r) => r.title.toLowerCase()));
  const rest = [...new Set(Object.values(order).flat())].filter((t) => !known.has(t.toLowerCase()));
  const restRows = rest.length
    ? await db.wikiArticle.findMany({
        where: { ...PUBLISHED, title: { in: rest, mode: "insensitive" } },
        select: ARTICLE,
      })
    : [];

  const byTitle = new Map(
    [...domainRows, ...restRows].map((r) => [
      r.title.toLowerCase(),
      {
        title: r.title,
        slug: r.slug,
        summary: r.summary,
        imageUrl: cleanLeadImage(r.leadImageUrl),
        readingTime: r.readingTime,
      },
    ])
  );
  const pick = (titles: string[]) => titles.flatMap((t) => byTitle.get(t.toLowerCase()) ?? []);
  return { economy: pick(order.economy), state: pick(order.state), foreign: pick(order.foreign) };
}
