/**
 * The import's quote pass: a quote in an imported post carries the XenForo id of the post it quotes
 * (`data-post`, bbcode.ts); here it becomes the native post id, or the attribute goes when that post was not
 * imported (deleted, skipped, or in another export). It runs after every thread is written, since a quote can point
 * at a later thread. Keyset-paged and idempotent (native ids are not digits); a run with failed threads keeps the
 * ids nothing maps yet, for the rerun.
 */
import { quotedXenforoPostIds, remapQuotePostIds } from "~/lib/thinkpages-forum/import/quote-ids";
import type { ImportDb } from "./import-db";

const PAGE = 500;

export interface QuoteRemap {
  /** Quote ids pointed at a native post (each distinct id once per post). */
  remapped: number;
  /** Quote ids removed because their post is not imported. */
  dropped: number;
}

export async function remapQuoteIds(
  db: Pick<ImportDb, "forumPost">,
  opts: { dropUnmapped: boolean }
): Promise<QuoteRemap> {
  const out: QuoteRemap = { remapped: 0, dropped: 0 };
  let after = "";
  for (;;) {
    const posts = await db.forumPost.findMany({
      where: { contentHtml: { contains: 'data-post="' }, id: { gt: after } },
      orderBy: { id: "asc" },
      take: PAGE,
      select: { id: true, contentHtml: true },
    });
    if (!posts.length) return out;
    after = posts[posts.length - 1]!.id;
    const wanted = new Set(posts.flatMap((p) => quotedXenforoPostIds(p.contentHtml)));
    if (!wanted.size) continue;
    const rows = await db.forumPost.findMany({
      where: { xenforoPostId: { in: [...wanted] } },
      select: { id: true, xenforoPostId: true },
    });
    const nativeOf = new Map(rows.map((r) => [r.xenforoPostId, r.id]));
    for (const post of posts) {
      const ids = quotedXenforoPostIds(post.contentHtml);
      if (!ids.length) continue;
      const html = remapQuotePostIds(
        post.contentHtml,
        (id) => nativeOf.get(id),
        opts.dropUnmapped ? "drop" : "keep"
      );
      if (html === post.contentHtml) continue;
      await db.forumPost.update({ where: { id: post.id }, data: { contentHtml: html } });
      for (const id of ids) {
        if (nativeOf.has(id)) out.remapped += 1;
        else if (opts.dropUnmapped) out.dropped += 1;
      }
    }
  }
}
