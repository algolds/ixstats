import { redirect } from "next/navigation";

export default function VaultMarketPage() {
  redirect("/vault/store?tab=auctions");
}
