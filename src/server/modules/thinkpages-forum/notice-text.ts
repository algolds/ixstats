/**
 * The words and shape of a forum notice, shared by the post notices (`post-notify.ts`: mention, quote, board reply) and
 * the watcher notice (`watch-notify.ts`), so a title is clipped and a link made in one place. The name is the post's
 * displayed author: a persona's name for a persona post, never the player's.
 */
import { postHref } from "~/lib/thinkpages-forum/links";
import type { ForumNotice } from "./forum-notices";

export type NoticeKind = ForumNotice["metadata"]["kind"];

const TITLE_MAX = 200;

export const clip = (text: string): string =>
  text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;

export interface NoticeSubject {
  postId: string;
  threadId: string;
  threadTitle: string;
  /** The post author's displayed name: the persona's, else the handle. */
  name: string;
  excerpt: string;
  /** The realm the post is in, for the board's wording. */
  realmName: string;
  /** The post is on the realm board. */
  board: boolean;
}

export function noticeFor(
  kind: NoticeKind,
  subject: NoticeSubject,
  clerkUserId: string
): ForumNotice {
  const { name, realmName } = subject;
  const where = subject.board ? `the ${realmName} board` : subject.threadTitle;
  const titles: Record<NoticeKind, string> = {
    mention: `${name} mentioned you in ${where}`,
    quote: `${name} quoted your post in ${where}`,
    reply: `${name} replied to you on the ${realmName} board`,
    watch: `New reply in ${subject.threadTitle}`,
  };
  const watch = kind === "watch";
  return {
    clerkUserId,
    title: clip(titles[kind]),
    message: watch ? clip(`${name}: ${subject.excerpt}`) : subject.excerpt,
    href: postHref(subject.postId),
    priority: watch ? "low" : "medium",
    metadata: { kind, postId: subject.postId, threadId: subject.threadId },
  };
}
