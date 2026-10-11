/**
 * Post previews outside the forum (spec 2026-10-10-thinkpages-forum-integrations-design.md): the Home feed's forum
 * cards, Home's "Your realm" panel, the realm overview's board block. Pure, so the server shapes them and the
 * browser types them from one place.
 */
import { withoutActionTokens } from "~/lib/action-links";

/** A feed card's excerpt, in characters. */
export const FEED_EXCERPT_MAX = 280;
/** A board message's excerpt in the Home panel and the overview block, in characters. */
export const PANEL_EXCERPT_MAX = 90;
/** How many board messages the panel and the overview block show. */
export const PANEL_MESSAGES = 3;

/**
 * A post's plain text as a preview line: action tokens (`[ixaction=<id>]`) stripped, whitespace collapsed, at most
 * `max` characters including the ellipsis, cut at a whole word (one word longer than the limit is cut hard), with
 * trailing punctuation dropped before the "…". Counts characters, not UTF-16 units.
 */
export function previewExcerpt(plainText: string, max: number): string {
  const text = withoutActionTokens(plainText).replace(/\s+/g, " ").trim();
  const chars = [...text];
  if (chars.length <= max) return text;
  const room = chars.slice(0, max - 1);
  // The word the cut lands in is dropped whole, unless the cut falls exactly on a space.
  const onBoundary = /\s/u.test(chars[max - 1] ?? "");
  const lastSpace = room.lastIndexOf(" ");
  const kept = onBoundary || lastSpace <= 0 ? room : room.slice(0, lastSpace);
  return `${kept.join("").replace(/[\s,;:.!?-]+$/u, "")}…`;
}

/** Who wrote it, as a preview may show them: a persona is its name and picture and never a flag or its player. */
export interface PreviewAuthor {
  name: string;
  avatarUrl: string | null;
  flagUrl: string | null;
  persona: boolean;
}

/** What a Home feed card shows of the post an item refers to. */
export interface ForumFeedPreview {
  threadId: string;
  title: string;
  threadHref: string;
  /** The previewed post's permalink, else the thread when no post is visible. */
  postHref: string;
  kind: "thread" | "reply";
  excerpt: string;
  author: PreviewAuthor;
  board: { name: string; href: string };
  /** `emblemUrl`, else `thumbnail`, is the realm's mark. */
  realm: { slug: string; name: string; emblemUrl: string | null; thumbnail: string | null } | null;
  style: "ic" | "ooc";
  replyCount: number;
  reactionTotal: number;
}

/** One of a realm board's newest messages, for the panel and the overview block. */
export interface BoardPreviewMessage {
  id: string;
  author: PreviewAuthor;
  excerpt: string;
  createdAt: Date;
  href: string;
}
