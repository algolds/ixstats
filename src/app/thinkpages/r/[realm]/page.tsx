import { type Metadata } from "next";
import { RealmLanding } from "~/components/thinkpages-forum/realm";

interface RealmPageProps {
  params: Promise<{ realm: string }>;
}

export const metadata: Metadata = {
  title: "ThinkPages - IxStats",
};

/** A realm's landing page: its live board, the realm's boards beside it. */
export default async function RealmPage({ params }: RealmPageProps) {
  const { realm } = await params;
  return <RealmLanding realm={realm} />;
}
