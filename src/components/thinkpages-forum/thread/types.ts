import type { RouterOutputs } from "~/trpc/react";

export type ThreadData = RouterOutputs["thinkpagesForum"]["thread"];
export type ForumPost = ThreadData["posts"][number];
/** How a board's posts read: in character as a WikiOS article, out of character as compact prose. */
export type PostStyle = "ic" | "ooc";
