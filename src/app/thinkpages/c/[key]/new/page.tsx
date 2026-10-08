import { type Metadata } from "next";
import { NewThreadForm } from "~/components/thinkpages-forum/NewThreadForm";

interface NewForumThreadPageProps {
  params: Promise<{ key: string }>;
}

export const metadata: Metadata = {
  title: "New thread - IxStats",
};

export default async function NewForumThreadPage({ params }: NewForumThreadPageProps) {
  const { key } = await params;
  return <NewThreadForm categoryKey={key} />;
}
