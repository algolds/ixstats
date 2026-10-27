import Link from "next/link";
import { CONTEST_PATH } from "~/components/lorewards/format";

interface AwardTrophyLinksProps {
  awards: Array<{ category: string; recipientUsers?: string[]; trophyCardId?: string | null }>;
}

const LINK = "text-caption text-tint duration-fast hover:text-tint-hover transition-colors";

/** The Lorewards page opened on a winner's trophies, and on their trophy card when there is one. */
const trophiesHref = (winner: string, cardId?: string | null) => {
  const params = new URLSearchParams({ user: winner });
  if (cardId) params.set("card", cardId);
  return `${CONTEST_PATH}?${params}`;
};

/** Where a Loreward badge leads: the winner's trophies and, once minted, the winner's trophy card. */
export function AwardTrophyLinks({ awards }: AwardTrophyLinksProps) {
  const wins = awards.filter((a) => a.category === "LOREWARD" && a.recipientUsers?.[0]);
  const win = wins.find((a) => a.trophyCardId) ?? wins[0];
  const winner = win?.recipientUsers?.[0];
  if (!win || !winner) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href={trophiesHref(winner)} className={LINK}>
        View trophies
      </Link>
      {win.trophyCardId && (
        <Link href={trophiesHref(winner, win.trophyCardId)} className={LINK}>
          View trophy card
        </Link>
      )}
    </div>
  );
}
