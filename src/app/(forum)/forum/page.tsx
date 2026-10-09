import { followLegacyRedirect } from "./legacy-gate";

export default function ForumIndexPage() {
  return followLegacyRedirect({ kind: "home" });
}
