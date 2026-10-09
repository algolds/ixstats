import { permanentRedirect } from "next/navigation";

interface LegacyProfilePageProps {
  params: Promise<{ username: string }>;
}

/** A persona's profile moved to the dashboard with the rest of the feed (phase 5). */
export default async function LegacyProfilePage({ params }: LegacyProfilePageProps) {
  const { username } = await params;
  permanentRedirect(`/dashboard/profile/${encodeURIComponent(username)}`);
}
