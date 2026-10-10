import { type Metadata } from "next";
import { BoardPage } from "~/components/thinkpages-forum/board";
import { pageParam } from "~/lib/thinkpages-forum/paging";
import { sortParam } from "~/lib/thinkpages-forum/thread-sort";

interface RealmCategoryPageProps {
  params: Promise<{ realm: string; key: string }>;
  searchParams: Promise<{ page?: string | string[]; sort?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
};

export default async function RealmCategoryPage({ params, searchParams }: RealmCategoryPageProps) {
  const [{ realm, key }, query] = await Promise.all([params, searchParams]);
  return (
    <BoardPage
      categoryKey={key}
      realm={realm}
      page={pageParam(query.page)}
      sort={sortParam(query.sort)}
    />
  );
}
