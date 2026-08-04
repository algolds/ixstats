// Redirects to Platform > System Health tab (system validation merged into platform)
import { redirect } from "next/navigation";
import { withBasePath } from "@/lib/base-path";


export default function SystemValidationPage() {
  redirect(withBasePath("/admin/platform"));
}
