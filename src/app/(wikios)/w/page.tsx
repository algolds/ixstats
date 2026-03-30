// src/app/(wikios)/w/page.tsx
// WikiOS Main Page — redirects to Main_Page article
import { redirect } from "next/navigation";
import { withBasePath } from "~/lib/base-path";

export default function WikiOSMainPage() {
  redirect(withBasePath("/w/Main_Page"));
}
