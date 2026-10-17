import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import type { ArtCredit } from "~/lib/cards/face/art-credit";

interface ArtCreditLineProps {
  credit: ArtCredit;
  /** Words before the credit, such as "Art:" where nothing else says what it credits. */
  label?: string;
  className?: string;
}

/**
 * The art credit on the card back and in the sheet, linked to the art's source when it has one; the licence follows
 * unless the line already names it.
 */
export function ArtCreditLine({ credit, label, className }: ArtCreditLineProps) {
  const licence = credit.licence && !credit.line.includes(credit.licence) ? credit.licence : null;
  return (
    <p className={cn("text-label-secondary", className)}>
      {label && `${label} `}
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
    </p>
  );
}
