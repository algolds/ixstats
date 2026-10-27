/**
 * src/app/robots.txt/route.ts: IxStates' robots rules (plan 412; B7 of the launch hardening). Articles
 * are indexable; tools, APIs, every non-reading view of a page (edit, history, diffs, old revisions,
 * raw text) and every `?source=` page are not. Every rule sits under the app's base path, and no
 * sitemap is listed: canonical URLs stay on classic ixwiki.com.
 *
 * Under the base path this file is served at `/projects/ixstates/robots.txt`, which crawlers never
 * read (they read only the host root's robots.txt, which classic owns). Runbook step 6d copies these
 * rules into classic's root robots.txt, so what this route serves is exactly what is copied.
 */

import { getBasePath } from "~/lib/base-path";
import { robotsTxt } from "~/lib/wiki-os/sitemap-xml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(robotsTxt(getBasePath()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
