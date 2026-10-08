import { type Metadata } from "next";
import { ThreadView } from "~/components/thinkpages-forum/ThreadView";
import { pageParam } from "~/lib/thinkpages-forum/paging";

interface ForumThreadPageProps {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages Forum - IxStats",
};

export default async function ForumThreadPage({ params, searchParams }: ForumThreadPageProps) {
  const [{ threadId }, query] = await Promise.all([params, searchParams]);
  return <ThreadView threadId={threadId} page={pageParam(query.page)} />;
}
