// src/app/(wiki-os)/wiki/watchlist/page.tsx
import { redirect } from "next/navigation";

export default function WikiWatchlistRedirect() {
  redirect("/util/watchlist");
}
