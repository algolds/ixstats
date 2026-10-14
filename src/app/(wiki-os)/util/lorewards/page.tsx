// WikiOS Lorewards: today's race, the standings and the history. The player's own trophies live in the Vault.
import type { Metadata } from "next";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { LorewardsView } from "~/components/lorewards/LorewardsView";

export const metadata: Metadata = {
  title: "Lorewards | WikiOS",
  description: "Today's Loreward race, the standings and the recent winners of IxWiki.",
};

export default function LorewardsPage() {
  return (
    <WikiOSLayout title="Lorewards">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <LorewardsView focus="contest" />
      </div>
    </WikiOSLayout>
  );
}
