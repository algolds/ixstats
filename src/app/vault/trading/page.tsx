import { redirect } from "next/navigation";

export default function VaultTradingPage() {
  redirect("/vault/store?tab=trading");
}
