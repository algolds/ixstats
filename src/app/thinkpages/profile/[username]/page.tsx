import { permanentRedirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface LegacyProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<PageQuery>;
}

/** A persona's profile moved to the dashboard with the rest of the feed (phase 5); the query string comes along. */
export default async function LegacyProfilePage({ params, searchParams }: LegacyProfilePageProps) {
  const { username } = await params;
  permanentRedirect(
    withQuery(`/dashboard/profile/${encodeURIComponent(username)}`, await searchParams)
  );
}
