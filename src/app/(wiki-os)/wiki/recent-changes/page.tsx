import { redirect } from "next/navigation";

export default function WikiRecentChangesRedirect() {
  redirect("/util/recent-changes");
}
