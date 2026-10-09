import { type Metadata } from "next";
import { ModConsole } from "~/components/thinkpages-forum/mod/ModConsole";
import { pageParam } from "~/lib/thinkpages-forum/paging";

interface ModerationPageProps {
  searchParams: Promise<{
    tab?: string | string[];
    realm?: string | string[];
    page?: string | string[];
  }>;
}

export const metadata: Metadata = {
  title: "Moderation - IxStats",
};

const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value) || undefined;

export default async function ModerationPage({ searchParams }: ModerationPageProps) {
  const query = await searchParams;
  return (
    <ModConsole tab={first(query.tab)} realm={first(query.realm)} page={pageParam(query.page)} />
  );
}
