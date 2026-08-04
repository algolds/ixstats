import { redirect } from "next/navigation";


export default function VaultPacksPage() {
  redirect("/vault/marketplace?tab=store");
}
