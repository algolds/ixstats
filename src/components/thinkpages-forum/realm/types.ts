import type { RouterOutputs } from "~/trpc/react";

export type BoardData = RouterOutputs["thinkpagesForum"]["getBoard"];
export type BoardMessageData = BoardData["messages"][number];
export type BoardAccess = BoardData["access"];

/** The realm a board belongs to, as its messages link and moderate it. */
export interface BoardRealm {
  slug: string;
  name: string;
}

/** The message the composer is answering. */
export interface ReplyTarget {
  postId: string;
  authorName: string;
}

/** A quote waiting to go into the composer; `key` tells one request from the next. */
export interface BoardQuote {
  key: number;
  text: string;
}
