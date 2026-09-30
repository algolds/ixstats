/**
 * Pages WikiOS remembers across visits (recent articles, reading progress) keep the wiki they were read from, so
 * reopening one lands on that wiki's read view, not on the IxWiki page of the same title (ruling E-l″).
 */
import { z } from "zod";
import { parseWikiSource, wikiReaderPath, type WikiSource } from "./config";

/** A remembered page. Entries saved before sources were recorded have none, and are IxWiki pages. */
export interface WikiPageRef {
  title: string;
  source?: WikiSource;
}

/** Recent articles as stored in sessionStorage; older entries are bare titles. */
export const recentArticlesSchema = z.array(
  z.union([
    z.string().transform((title): WikiPageRef => ({ title })),
    z.object({ title: z.string(), source: z.string().transform(parseWikiSource).optional() }),
  ])
);

export function isSamePage(page: WikiPageRef, title: string, source: WikiSource): boolean {
  return page.title === title && parseWikiSource(page.source) === source;
}

/** The reader path that reopens a remembered page on its own wiki. */
export function pageRefPath(page: WikiPageRef): string {
  return wikiReaderPath(page.title, parseWikiSource(page.source));
}
