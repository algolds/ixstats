import { redirect } from "next/navigation";
import { IXNAY_SLUG, isIxnaySlug } from "~/lib/realms/realm-ids";
import { realmBoardHref } from "~/lib/thinkpages-forum/links";

/**
 * The realm's board page is the live board in the forum (`/thinkpages/r/<slug>`): old links and the tab land there.
 * Ixnay's older slugs ("default", "ixworld") go to its canonical slug, the one the forum's realm section is keyed by.
 */
export default async function RealmBoardPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm } = await params;
  redirect(realmBoardHref(isIxnaySlug(realm) ? IXNAY_SLUG : realm));
}
