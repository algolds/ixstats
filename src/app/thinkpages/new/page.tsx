import { type Metadata } from "next";
import { NewPostsPage } from "~/components/thinkpages-forum/lists";
import { NEW_POSTS_HREF } from "~/lib/thinkpages-forum/links";
import { pageParam } from "~/lib/thinkpages-forum/paging";
import { requireSignIn } from "../_lib/require-sign-in";

interface NewPostsRouteProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
};

/** Unread threads across the boards the member can see; signed-out visitors are sent to sign-in. */
export default async function NewPostsRoute({ searchParams }: NewPostsRouteProps) {
  await requireSignIn(NEW_POSTS_HREF);
  const { page } = await searchParams;
  return <NewPostsPage page={pageParam(page)} />;
}
