import { permanentRedirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface LegacySavedPageProps {
  searchParams: Promise<PageQuery>;
}

/** Saved posts moved to the dashboard with the rest of the feed (phase 5); the query string comes along. */
export default async function LegacySavedPage({ searchParams }: LegacySavedPageProps) {
  permanentRedirect(withQuery("/dashboard/saved", await searchParams));
}
