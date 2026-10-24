import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Signal } from "~/components/ui/signal";
import { ixstatesLinkHref } from "~/lib/system/wikios-standalone";

interface ClaimNamePointerProps {
  /** The viewer's unclaimed wiki name, when places are recorded under it. */
  wikiUsername: string | null;
  /** How many classic wiki places under `wikiUsername` no account holds yet. */
  unmatched: number;
}

/** For a viewer with no approved wiki name: classic wiki wins come to the account once a name claim is approved. */
export function ClaimNamePointer({ wikiUsername, unmatched }: ClaimNamePointerProps) {
  return (
    <Signal tone="info" title="Claim your old IxWiki names">
      <p>
        {wikiUsername && unmatched > 0
          ? `Some classic wiki wins under ${wikiUsername} may be yours. Claim the name in Settings, and once an administrator approves it, its wins, trophy cards and payouts come to you.`
          : "Edited the classic wiki before WikiOS? Claim the names you used in Settings, and once an administrator approves one, its wins, trophy cards and payouts come to you."}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link href={ixstatesLinkHref("/settings?tab=account")}>Claim a name</Link>
      </Button>
    </Signal>
  );
}
