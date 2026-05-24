import { redirect } from "next/navigation";

export default function LoreBatchRedirectPage() {
  redirect("/admin/cards?tab=lore");
}
