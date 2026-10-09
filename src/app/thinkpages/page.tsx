import { type Metadata } from "next";
import { CategoryList } from "~/components/thinkpages-forum/CategoryList";

interface ThinkPagesHomeProps {
  searchParams: Promise<{ realm?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
  description: "The community forum: sitewide boards and a section for every realm.",
};

/** The forum home: sitewide categories, the old forum's archive and the realm section `?realm=` opens. */
export default async function ThinkPagesHomePage({ searchParams }: ThinkPagesHomeProps) {
  const { realm } = await searchParams;
  const slug = Array.isArray(realm) ? realm[0] : realm;
  // An empty `?realm=` opens the viewer's default realm, like no parameter.
  return <CategoryList realm={slug || undefined} />;
}
