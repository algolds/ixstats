import { permanentRedirect } from "next/navigation";

/** Saved posts moved to the dashboard with the rest of the feed (phase 5). */
export default function LegacySavedPage() {
  permanentRedirect("/dashboard/saved");
}
