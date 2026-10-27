import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import type { ArtCredit } from "~/lib/cards/face/art-credit";

interface ArtCreditLineProps {
  credit: ArtCredit;
  /** Words before the credit, such as "Art:", since the caption it sits in credits more than the art. */
  label: string;
}

/**
 * The art credit in the sheet's credits caption, linked to the art's source when it has one; the licence follows
 * unless the line already names it.
 */
export function ArtCreditLine({ credit, label }: ArtCreditLineProps) {
  const licence = credit.licence && !credit.line.includes(credit.licence) ? credit.licence : null;
  return (
    <span>
      {`${label} `}
      {credit.sourceUrl ? (
        <a
          href={credit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("underline", focusRing)}
        >
          {credit.line}
        </a>
      ) : (
        credit.line
      )}
      {licence && ` · ${licence}`}
    </span>
  );
}
