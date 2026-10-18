import { type Metadata } from "next";
import { ForumHome } from "~/components/thinkpages-forum/home";

export const metadata: Metadata = {
  title: "ThinkPages - IxStates",
  description: "The community forum: sitewide boards and a section for every realm.",
};

/** The Forums home: the sitewide boards and the old forum's archive. */
export default function ThinkPagesHomePage() {
  return <ForumHome />;
}
