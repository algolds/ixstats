import "server-only";

import { redirect } from "next/navigation";
import type { LegacyTarget } from "~/lib/wiki-os/wiki-path";
import { api } from "~/trpc/server";
import { orNotFound } from "../_lib/or-not-found";

/**
 * An old WikiOS URL (`/wiki/recent-changes`, `/wiki/A/edit`, `/wiki/A/talk`) goes to the tool or
 * page it used to open, unless the wiki has a page of exactly that title: then the page wins, and
 * this returns so the route can render it. A title is never hijacked by a tool.
 */
export async function redirectUnlessArticle(target: LegacyTarget): Promise<void> {
  const missing = await orNotFound(api.wikios.getMissingPages({ titles: [target.canon.title] }));
  if (missing.length > 0) redirect(target.href);
}
