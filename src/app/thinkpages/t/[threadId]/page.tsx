import { type Metadata } from "next";
import { ThreadPage } from "~/components/thinkpages-forum/thread";
import { pageParam } from "~/lib/thinkpages-forum/paging";

interface ForumThreadPageProps {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
};

export default async function ForumThreadPage({ params, searchParams }: ForumThreadPageProps) {
  const [{ threadId }, query] = await Promise.all([params, searchParams]);
  return <ThreadPage threadId={threadId} page={pageParam(query.page)} />;
}
