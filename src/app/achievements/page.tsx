import { redirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface AchievementsRedirectProps {
  searchParams: Promise<PageQuery>;
}

/** Achievements live in the Vault now; `?a=<key>` and `?tab=` carry over. */
export default async function AchievementsPage({ searchParams }: AchievementsRedirectProps) {
  redirect(withQuery("/vault/achievements", await searchParams));
}
