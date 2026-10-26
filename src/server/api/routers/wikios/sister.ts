/**
 * sister.ts: WikiOS's live sister embeds. `sisterEmbed` is what the reader asks for each `Template:Sister` box
 * (sister-embed.ts): the whole page, one section, the infobox or a card of a page on IIWiki or AltHistory, read by
 * `getSisterEmbed` (cached an hour, single flight). A wiki that cannot be reached is SERVICE_UNAVAILABLE (the tRPC
 * formatter).
 *
 * An embed that is not cached costs the wiki up to two calls, out of a per-host budget of 240 a minute shared by every
 * reader, so only those reads count, against a bucket of the caller's own (`sisterembed`): `EMBED_READS_PER_MINUTE`, 20
 * for a visitor and `SISTER_CALLER_LIMITS.embed` (30) signed in. A visitor, or a script, asking for random titles would
 * otherwise leave every other reader's sister content "busy". Cache hits are free.
 */
import { z } from "zod/v4";
import { createTRPCRouter, enforceRateLimit, publicProcedure } from "~/server/api/trpc";
import { embedPart, isSisterEmbedTitle, SISTER_EMBED_MODES } from "~/lib/wiki-os/sister-embed";
import { getSisterEmbed } from "~/lib/wiki-os/services/sister-embed-service";
import { SISTER_CALLER_LIMITS } from "./search";

/**
 * Embeds a caller may read from a sister wiki a minute (cache hits are free): a visitor two pages of ten boxes, a
 * signed-in reader `SISTER_CALLER_LIMITS.embed` (2 calls each, a quarter of the host's budget).
 */
export const EMBED_READS_PER_MINUTE = {
  visitor: 20,
  signedIn: SISTER_CALLER_LIMITS.embed.max,
} as const;

/** The caller's `sisterembed` bucket: the visitor's limit or the signed-in reader's. */
function embedReadLimit(ctx: { auth?: { userId?: string | null } | null }) {
  const max = ctx.auth?.userId ? EMBED_READS_PER_MINUTE.signedIn : EMBED_READS_PER_MINUTE.visitor;
  return { ...SISTER_CALLER_LIMITS.embed, max };
}

export const wikiosSisterRouter = createTRPCRouter({
  sisterEmbed: publicProcedure
    .input(
      z.object({
        wiki: z.enum(["iiwiki", "althistory"]),
        title: z.string().refine(isSisterEmbedTitle, "Not a page title"),
        mode: z.enum(SISTER_EMBED_MODES).default("page"),
        section: z.string().trim().min(1).max(255).optional(),
      })
    )
    .query(({ ctx, input, path }) =>
      getSisterEmbed(
        { wiki: input.wiki, title: input.title, ...embedPart(input.mode, input.section ?? null) },
        () => enforceRateLimit(ctx.rateLimitIdentifier, path, embedReadLimit(ctx))
      )
    ),
});
