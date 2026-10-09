import { followLegacyRedirect } from "../legacy-gate";
import NewThreadClient from "./NewThreadClient";

export default async function NewThreadPage() {
  await followLegacyRedirect({ kind: "other" });
  return <NewThreadClient />;
}
