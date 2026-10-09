import { permanentRedirect } from "next/navigation";

/** ThinkShare became Messages. */
export default function LegacyThinkSharePage() {
  permanentRedirect("/messages");
}
