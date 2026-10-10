import { followLegacyRedirect } from "../legacy-gate";

export default function ForumSearchPage() {
  return followLegacyRedirect({ kind: "other" });
}
