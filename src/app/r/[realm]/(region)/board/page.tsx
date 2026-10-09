import { redirect } from "next/navigation";
import { hubHref } from "~/lib/thinkpages-forum/links";

/** The realm board is now the realm's section of the forum (phase 2): old links land on its Hub. */
export default async function RealmBoardPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm } = await params;
  redirect(hubHref(realm));
}
