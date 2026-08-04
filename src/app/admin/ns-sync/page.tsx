import { redirect } from "next/navigation";


export default function NSSyncRedirectPage() {
  redirect("/admin/cards?tab=sync");
}
