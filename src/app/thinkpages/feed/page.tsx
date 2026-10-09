import { permanentRedirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface LegacyFeedPageProps {
  searchParams: Promise<PageQuery>;
}

/** The feed lives on the dashboard; the query string comes along. */
export default async function LegacyFeedPage({ searchParams }: LegacyFeedPageProps) {
  permanentRedirect(withQuery("/dashboard", await searchParams));
}
