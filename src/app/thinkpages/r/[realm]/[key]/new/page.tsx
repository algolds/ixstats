import { type Metadata } from "next";
import { NewThreadForm } from "~/components/thinkpages-forum/NewThreadForm";

interface NewRealmThreadPageProps {
  params: Promise<{ realm: string; key: string }>;
}

export const metadata: Metadata = {
  title: "New thread - IxStats",
};

export default async function NewRealmThreadPage({ params }: NewRealmThreadPageProps) {
  const { realm, key } = await params;
  return <NewThreadForm categoryKey={key} realm={realm} />;
}
