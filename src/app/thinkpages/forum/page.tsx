import { permanentRedirect } from "next/navigation";
import { forumHomeHref } from "~/lib/thinkpages-forum/links";

interface OldForumHomeProps {
  searchParams: Promise<{ realm?: string | string[] }>;
}

/**
 * The forum home's phase 1-4 address. It moved to /thinkpages for good (308), keeping the realm section; stored
 * links such as moderation notices' `#standing` keep their fragment, which the browser carries over the redirect.
 */
export default async function OldForumHomePage({ searchParams }: OldForumHomeProps) {
  const { realm } = await searchParams;
  permanentRedirect(forumHomeHref(Array.isArray(realm) ? realm[0] : realm));
}
