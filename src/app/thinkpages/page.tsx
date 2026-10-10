import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { ForumHome } from "~/components/thinkpages-forum/home";
import { hubHref } from "~/lib/thinkpages-forum/links";

interface ThinkPagesHomeProps {
  searchParams: Promise<{ realm?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
  description: "The community forum: sitewide boards and a section for every realm.",
};

/** The Forums home: the sitewide boards and the old forum's archive. An old `?realm=` link opens that realm's Hub. */
export default async function ThinkPagesHomePage({ searchParams }: ThinkPagesHomeProps) {
  const { realm } = await searchParams;
  const slug = Array.isArray(realm) ? realm[0] : realm;
  // An empty `?realm=` is no realm, like no parameter.
  if (slug) redirect(hubHref(slug));
  return <ForumHome />;
}
