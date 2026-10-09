import { type Metadata } from "next";
import { ThreadList } from "~/components/thinkpages-forum/ThreadList";
import { pageParam } from "~/lib/thinkpages-forum/paging";

interface ForumCategoryPageProps {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages Forum - IxStats",
};

export default async function ForumCategoryPage({ params, searchParams }: ForumCategoryPageProps) {
  const [{ key }, query] = await Promise.all([params, searchParams]);
  return <ThreadList categoryKey={key} page={pageParam(query.page)} />;
}
