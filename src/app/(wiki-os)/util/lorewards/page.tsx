// src/app/(wiki-os)/util/lorewards/page.tsx
// Instant redirect to unified Achievements hub with Wiki & Lorewards tab focused.

import { redirect } from "next/navigation";
import { ixstatesHref } from "~/lib/system/wikios-standalone";

export default function LorewardsPage() {
  redirect(ixstatesHref("/achievements?tab=wiki-lore"));
}
