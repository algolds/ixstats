import Link from "next/link";
import { VAULT_TROPHIES_PATH } from "~/components/lorewards/format";
import { ixstatesLinkHref } from "~/lib/system/wikios-standalone";

interface AwardTrophyLinksProps {
  awards: Array<{ category: string; trophyCardId?: string | null }>;
}

const LINK = "text-caption text-tint duration-fast hover:text-tint-hover transition-colors";

/** Where a Loreward badge leads: the winner's trophies in the Vault and, once minted, the trophy card. */
export function AwardTrophyLinks({ awards }: AwardTrophyLinksProps) {
  const loreward = awards.filter((a) => a.category === "LOREWARD");
  if (loreward.length === 0) return null;
  const cardId = loreward.find((a) => a.trophyCardId)?.trophyCardId;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href={ixstatesLinkHref(VAULT_TROPHIES_PATH)} className={LINK}>
        View trophies
      </Link>
      {cardId && (
        <Link
          href={ixstatesLinkHref(`${VAULT_TROPHIES_PATH}&card=${encodeURIComponent(cardId)}`)}
          className={LINK}
        >
          View trophy card
        </Link>
      )}
    </div>
  );
}
