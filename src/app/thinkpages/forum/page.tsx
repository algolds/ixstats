import { type Metadata } from "next";
import { CategoryList } from "~/components/thinkpages-forum/CategoryList";

export const metadata: Metadata = {
  title: "ThinkPages Forum - IxStats",
  description:
    "Sitewide discussion on ThinkPages: announcements, general talk, side games and more.",
};

export default function ThinkPagesForumPage() {
  return <CategoryList />;
}
