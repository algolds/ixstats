import { type Metadata } from "next";
import { WatchedPage } from "~/components/thinkpages-forum/lists";
import { WATCHED_HREF } from "~/lib/thinkpages-forum/links";
import { pageParam } from "~/lib/thinkpages-forum/paging";
import { requireSignIn } from "../_lib/require-sign-in";

interface WatchedRouteProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
};

/** The threads the member watches; signed-out visitors are sent to sign-in. */
export default async function WatchedRoute({ searchParams }: WatchedRouteProps) {
  await requireSignIn(WATCHED_HREF);
  const { page } = await searchParams;
  return <WatchedPage page={pageParam(page)} />;
}
