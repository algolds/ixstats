// src/app/(wiki-os)/wiki/lorewards/page.tsx
// Instant redirect to unified Achievements hub with Wiki & Lorewards tab focused.

import { redirect } from "next/navigation";
import { withBasePath } from "~/lib/base-path";

export default function LorewardsPage() {
  redirect(withBasePath("/achievements?tab=wiki-lore"));
}
