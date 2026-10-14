// WikiOS Lorewards: today's race, the standings and the history. The player's own trophies live in the Vault;
// an article's Loreward badge opens this page on its winner's trophies (?user=, and ?card= for the trophy card).
import type { Metadata } from "next";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { LorewardsView } from "~/components/lorewards/LorewardsView";

export const metadata: Metadata = {
  title: "Lorewards | WikiOS",
  description: "Today's Loreward race, the standings and the recent winners of IxWiki.",
};

type Param = string | string[] | undefined;

const first = (value: Param) => (Array.isArray(value) ? value[0] : value) || undefined;

export default async function LorewardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, Param>>;
}) {
  const { user, card } = await searchParams;
  return (
    <WikiOSLayout title="Lorewards">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <LorewardsView focus="contest" username={first(user)} highlightCardId={first(card)} />
      </div>
    </WikiOSLayout>
  );
}
