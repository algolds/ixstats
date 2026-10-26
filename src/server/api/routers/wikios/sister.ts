/**
 * sister.ts: WikiOS's live sister embeds. `sisterEmbed` is what the reader asks for each `Template:Sister` box
 * (sister-embed.ts): the whole page, one section, the infobox or a card of a page on IIWiki or AltHistory, read by
 * `getSisterEmbed` (cached an hour, single flight). It shares the `sisterwiki` rate-limit bucket with the other
 * procedures that read a sister wiki; a wiki that cannot be reached is SERVICE_UNAVAILABLE (the tRPC formatter).
 */
import { z } from "zod/v4";
import { createTRPCRouter } from "~/server/api/trpc";
import { embedPart, isSisterEmbedTitle, SISTER_EMBED_MODES } from "~/lib/wiki-os/sister-embed";
import { getSisterEmbed } from "~/lib/wiki-os/services/sister-embed-service";
import { sisterWikiProcedure } from "./search";

export const wikiosSisterRouter = createTRPCRouter({
  sisterEmbed: sisterWikiProcedure
    .input(
      z.object({
        wiki: z.enum(["iiwiki", "althistory"]),
        title: z.string().refine(isSisterEmbedTitle, "Not a page title"),
        mode: z.enum(SISTER_EMBED_MODES).default("page"),
        section: z.string().trim().min(1).max(255).optional(),
      })
    )
    .query(({ input }) =>
      getSisterEmbed({
        wiki: input.wiki,
        title: input.title,
        ...embedPart(input.mode, input.section ?? null),
      })
    ),
});
