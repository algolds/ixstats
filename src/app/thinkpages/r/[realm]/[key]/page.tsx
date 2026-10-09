import { type Metadata } from "next";
import { ThreadList } from "~/components/thinkpages-forum/ThreadList";
import { pageParam } from "~/lib/thinkpages-forum/paging";

interface RealmCategoryPageProps {
  params: Promise<{ realm: string; key: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
};

export default async function RealmCategoryPage({ params, searchParams }: RealmCategoryPageProps) {
  const [{ realm, key }, query] = await Promise.all([params, searchParams]);
  return <ThreadList categoryKey={key} realm={realm} page={pageParam(query.page)} />;
}
