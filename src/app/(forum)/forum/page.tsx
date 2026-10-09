import { followLegacyRedirect } from "./legacy-gate";
import ForumHomeClient from "./ForumHomeClient";

export default async function ForumIndexPage() {
  await followLegacyRedirect({ kind: "home" });
  return <ForumHomeClient />;
}
