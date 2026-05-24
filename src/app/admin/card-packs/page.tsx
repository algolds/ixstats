import { redirect } from "next/navigation";

export default function CardPacksRedirectPage() {
  redirect("/admin/cards?tab=packs");
}
