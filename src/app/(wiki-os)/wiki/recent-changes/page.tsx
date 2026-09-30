// src/app/(wiki-os)/wiki/recent-changes/page.tsx
import { redirect } from "next/navigation";

export default function WikiRecentChangesRedirect() {
  redirect("/util/recent-changes");
}
