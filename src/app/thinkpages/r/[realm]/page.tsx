import { redirect } from "next/navigation";
import { forumHomeHref } from "~/lib/thinkpages-forum/links";

interface RealmForumPageProps {
  params: Promise<{ realm: string }>;
}

/** A realm's section lives on the forum home: open it there with the switcher on that realm. */
export default async function RealmForumPage({ params }: RealmForumPageProps) {
  const { realm } = await params;
  redirect(forumHomeHref(realm));
}
