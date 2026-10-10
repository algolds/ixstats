import { redirect } from "next/navigation";
import { hubHref } from "~/lib/thinkpages-forum/links";

interface RealmForumPageProps {
  params: Promise<{ realm: string }>;
}

/** A realm's section is its Hub board. */
export default async function RealmForumPage({ params }: RealmForumPageProps) {
  const { realm } = await params;
  redirect(hubHref(realm));
}
