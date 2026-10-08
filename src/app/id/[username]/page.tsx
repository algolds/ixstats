import { permanentRedirect } from "next/navigation";
import { passportSegmentHandleOrRaw } from "~/lib/passport/passport-segment";
import { needsCanonicalRedirect } from "~/server/modules/identity/identity.handle";
import { resolveCanonicalHandle } from "~/server/modules/identity/identity.resolve";
import { PassportPageClient } from "./PassportPageClient";

interface PassportPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * A legacy passport URL (forum name, wiki name, Clerk id, user id) 308s to `/@{handle}` once the
 * holder has a stored handle, keeping `?tab=`. The redirect lives here, not in the layout, because
 * only a page receives `searchParams`. `/@me` never redirects.
 */
export default async function PassportPage({ params, searchParams }: PassportPageProps) {
  const segment = passportSegmentHandleOrRaw((await params).username);
  const canonical = await resolveCanonicalHandle(segment).catch(() => null);
  if (canonical && needsCanonicalRedirect(segment, canonical.handle)) {
    const { tab } = await searchParams;
    const query = typeof tab === "string" && tab ? `?tab=${encodeURIComponent(tab)}` : "";
    permanentRedirect(`/@${canonical.handle}${query}`);
  }
  return <PassportPageClient handle={segment} />;
}
