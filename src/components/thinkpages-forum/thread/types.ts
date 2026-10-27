import type { RouterOutputs } from "~/trpc/react";

export type ThreadData = RouterOutputs["thinkpagesForum"]["thread"];
export type ForumPost = ThreadData["posts"][number];
/** How a board's posts read: in character as a WikiOS article, out of character as compact prose. */
export type PostStyle = "ic" | "ooc";
/** A post edit as the server takes it: light-editor HTML, or Canvas wikitext. */
export type EditBody = { html: string } | { wikitext: string };
