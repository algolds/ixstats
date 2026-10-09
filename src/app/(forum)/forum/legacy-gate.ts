/**
 * The legacy redirect gate every `/forum/*` page awaits first (phase 4, Task 6): while the legacy switch is on it
 * redirects (307, temporary: Q8) to the native forum page for `ref`; while off it returns and the bridge page renders.
 * `connection()` keeps every gated page dynamic, so the switch is never frozen into a prerendered page.
 */
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { LegacyForumRef } from "~/lib/thinkpages-forum/legacy-forum";
import { db } from "~/server/db";
import { legacyForumRedirectFor } from "~/server/modules/thinkpages-forum";

export async function followLegacyRedirect(ref: LegacyForumRef): Promise<void> {
  await connection();
  const to = await legacyForumRedirectFor(db, ref);
  if (to) redirect(to);
}
