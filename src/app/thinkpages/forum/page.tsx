import { type Metadata } from "next";
import { CategoryList } from "~/components/thinkpages-forum/CategoryList";

interface ThinkPagesForumPageProps {
  searchParams: Promise<{ realm?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages Forum - IxStats",
  description:
    "Discussion on ThinkPages: sitewide categories and a forum section for every realm.",
};

export default async function ThinkPagesForumPage({ searchParams }: ThinkPagesForumPageProps) {
  const { realm } = await searchParams;
  const slug = Array.isArray(realm) ? realm[0] : realm;
  // An empty `?realm=` opens the viewer's default realm, like no parameter.
  return <CategoryList realm={slug || undefined} />;
}
