import { followLegacyRedirect } from "../legacy-gate";

export default function NewThreadPage() {
  return followLegacyRedirect({ kind: "other" });
}
