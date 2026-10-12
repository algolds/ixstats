import { type Metadata } from "next";
import { StashedPage } from "~/components/thinkpages-forum/lists";
import { STASHED_HREF } from "~/lib/thinkpages-forum/links";
import { requireSignIn } from "../_lib/require-sign-in";

export const metadata: Metadata = {
  title: "ThinkPages - IxStates",
};

/** The threads the member stashed; signed-out visitors are sent to sign-in. */
export default async function StashedRoute() {
  await requireSignIn(STASHED_HREF);
  return <StashedPage />;
}
