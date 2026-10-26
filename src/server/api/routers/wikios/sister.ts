/**
 * sister.ts: WikiOS's live sister embeds. `sisterEmbed` is what the reader asks for each `Template:Sister` box
 * (sister-embed.ts): the whole page, one section, the infobox or a card of a page on IIWiki or AltHistory, read by
 * `getSisterEmbed` (cached an hour, single flight). It shares the `sisterwiki` rate-limit bucket with the other
 * procedures that read a sister wiki; a wiki that cannot be reached is SERVICE_UNAVAILABLE (the tRPC formatter).
 *
 * An embed that is not cached costs the wiki up to two calls, out of a per-host budget of 240 a minute shared by every
 * reader, so those reads have a lower limit of their own per caller (`EMBED_READS_PER_MINUTE`): a visitor, or a
 * script, asking for random titles at the full `sisterwiki` rate would otherwise leave every other reader's sister
 * content "busy". Signed-in readers get more. Cached embeds count only against `sisterwiki`.
 */
import { z } from "zod/v4";
import { rateLimiter } from "~/lib/cache";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter } from "~/server/api/trpc";
import { embedPart, isSisterEmbedTitle, SISTER_EMBED_MODES } from "~/lib/wiki-os/sister-embed";
import { getSisterEmbed } from "~/lib/wiki-os/services/sister-embed-service";
import { sisterWikiProcedure } from "./search";

/** Embeds a caller may have read from a sister wiki (not served from the cache) a minute: two pages of ten boxes, or six. */
export const EMBED_READS_PER_MINUTE = { visitor: 20, signedIn: 60 } as const;

/** Refuses (TOO_MANY_REQUESTS) a caller past their sister-wiki embed reads for the minute. */
async function admitEmbedRead(ctx: {
  rateLimitIdentifier: string;
  auth?: { userId?: string | null } | null;
}): Promise<void> {
  if (!rateLimiter.isEnabled()) return;
  const max = ctx.auth?.userId ? EMBED_READS_PER_MINUTE.signedIn : EMBED_READS_PER_MINUTE.visitor;
  const result = await rateLimiter.check(ctx.rateLimitIdentifier, "sisterwiki-embed-read", {
    maxRequests: max,
    windowMs: 60_000,
  });
  if (!result.success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many new sister wiki embeds. Maximum ${max} a minute. Try again at ${result.resetAt.toISOString()}`,
    });
  }
}

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
    .query(({ input, ctx }) =>
      getSisterEmbed(
        {
          wiki: input.wiki,
          title: input.title,
          ...embedPart(input.mode, input.section ?? null),
        },
        () => admitEmbedRead(ctx)
      )
    ),
});
