import { followLegacyRedirect } from "../legacy-gate";

export default function ForumStashesPage() {
  return followLegacyRedirect({ kind: "other" });
}
