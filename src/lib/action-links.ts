/**
 * Action-linked posts (spec docs/superpowers/specs/2026-10-07-action-linked-posts-design.md): a post
 * embeds one of its country's ActivityFeed entries as `[ixaction=<id>]`. Pure helpers only; the
 * ownership check and persistence live in `~/server/modules/action-links`.
 */
import { IxTime } from "~/lib/ixtime";

export const MAX_ACTIONS_PER_POST = 10;

export type PostSource = "native" | "xenforo";

const TOKEN = /\[ixaction=([A-Za-z0-9_-]{1,64})\]/g;

/** Distinct activity ids embedded in `body`, in first-seen order. Callers enforce MAX_ACTIONS_PER_POST. */
export function parseActionTokens(body: string): string[] {
  return [...new Set(Array.from(body.matchAll(TOKEN), (m) => m[1]!))];
}

/** Where a linked post lives: native posts by the ThinkPages permalink, imported ones on the old forum. */
export function postPermalinkPath(source: PostSource, postRef: string): string {
  return source === "native"
    ? `/thinkpages/p/${encodeURIComponent(postRef)}`
    : `https://forum.ixwiki.com/posts/${encodeURIComponent(postRef)}/`;
}

export interface ChainWikiEntry {
  title: string;
  type: string;
  ixTime: number;
  url: string;
}

/** Player text inside wikitext: no link, template or table syntax survives. */
function plain(text: string): string {
  return text.replace(/[[\]{}|<>]/g, "").trim();
}

/** The section appended to the chain's wiki page on approval. */
export function chainWikiSection(input: {
  title: string;
  approvedIxTime: number;
  entries: ChainWikiEntry[];
}): string {
  const lines = input.entries.map(
    (e) => `* ${IxTime.formatIxTime(e.ixTime)}: [${e.url} ${plain(e.title)}] (${plain(e.type)})`
  );
  return [
    `== Story chain: ${plain(input.title)} ==`,
    `''Recorded ${IxTime.formatIxTime(input.approvedIxTime)}.''`,
    ...lines,
  ].join("\n");
}
