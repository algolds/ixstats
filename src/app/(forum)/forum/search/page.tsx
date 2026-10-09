import { followLegacyRedirect } from "../legacy-gate";
import ForumSearchClient from "./ForumSearchClient";

export default async function ForumSearchPage() {
  await followLegacyRedirect({ kind: "other" });
  return <ForumSearchClient />;
}
