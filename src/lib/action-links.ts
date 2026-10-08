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

export type BodySegment = { kind: "html"; text: string } | { kind: "action"; id: string };

/** `body` cut on its `[ixaction=<id>]` tokens, in order; empty html segments are dropped. */
export function splitActionTokens(body: string): BodySegment[] {
  return body
    .split(TOKEN)
    .flatMap((part, i): BodySegment[] =>
      i % 2 === 1 ? [{ kind: "action", id: part }] : part ? [{ kind: "html", text: part }] : []
    );
}

/** Where a linked post lives: native posts by the ThinkPages permalink, imported ones on the old forum. */
export function postPermalinkPath(source: PostSource, postRef: string): string {
  return source === "native"
    ? `/thinkpages/post/${encodeURIComponent(postRef)}`
    : `https://forum.ixwiki.com/posts/${encodeURIComponent(postRef)}/`;
}

export interface ChainWikiEntry {
  title: string;
  type: string;
  ixTime: number;
  url: string;
}

const WIKITEXT_MARKUP = /[[\]{}|<>&]|'{2,}|~{3,}|_{2,}/g;

/**
 * Player text inside wikitext, as a single plain line: no link, template, table, entity, bold or
 * italic, signature or magic-word syntax survives, and no newline can start a new heading.
 */
function plain(text: string): string {
  let out = text;
  let prev: string;
  do {
    prev = out;
    out = out.replace(WIKITEXT_MARKUP, "");
  } while (out !== prev);
  return out.replace(/\s+/g, " ").trim();
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
