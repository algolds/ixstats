import { permanentRedirect } from "next/navigation";

/** The feed lives on the dashboard. */
export default function LegacyFeedPage() {
  permanentRedirect("/dashboard");
}
