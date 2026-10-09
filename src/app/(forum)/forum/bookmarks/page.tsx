import { followLegacyRedirect } from "../legacy-gate";
import ForumStashesClient from "./ForumStashesClient";

export default async function ForumStashesPage() {
  await followLegacyRedirect({ kind: "other" });
  return <ForumStashesClient />;
}
