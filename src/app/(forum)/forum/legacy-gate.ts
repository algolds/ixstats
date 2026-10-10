/**
 * The redirect every `/forum/*` page of the retired XenForo bridge answers (phase 4b): a permanent redirect (308) to
 * the native forum page for `ref`, resolved through the import's id map; anything unknown lands on the forum home.
 * `connection()` keeps every page dynamic, so a target is never frozen into a prerendered page while the import
 * fills the id map.
 */
import { permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import type { LegacyForumRef } from "~/lib/thinkpages-forum/legacy-forum";
import { db } from "~/server/db";
import { legacyForumRedirectFor } from "~/server/modules/thinkpages-forum";

export async function followLegacyRedirect(ref: LegacyForumRef): Promise<never> {
  await connection();
  permanentRedirect(await legacyForumRedirectFor(db, ref));
}
