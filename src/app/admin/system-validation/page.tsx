// Redirects to Platform > System Health tab (system validation merged into platform)
import { redirect } from "next/navigation";
import { withBasePath } from "@/lib/base-path";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function SystemValidationPage() {
  redirect(withBasePath("/admin/platform"));
}
