import { redirect } from "next/navigation";
import { realmBoardHref } from "~/lib/thinkpages-forum/links";

/** The realm's board page is the live board in the forum (`/thinkpages/r/<slug>`): old links and the tab land there. */
export default async function RealmBoardPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm } = await params;
  redirect(realmBoardHref(realm));
}
