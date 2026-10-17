import { RarityMark } from "~/components/cards/face/RarityMark";
import { RARITY_LABEL, RARITY_ORDER } from "~/lib/cards/face/labels";
import type { CardRarity } from "~/lib/cards/face/types";
import { formatOdds, packOddsRows, type PackOdds as PackOddsValues } from "~/lib/cards/pack-odds";

/** Nothing is rarer than the top rarity, so its guarantee drops "or rarer". */
function guaranteeLine(rarity: CardRarity): string {
  const label = RARITY_LABEL[rarity];
  const rarest = rarity === RARITY_ORDER[RARITY_ORDER.length - 1];
  return `Every pack has at least one ${rarest ? label : `${label} or rarer`} card.`;
}

/** A pack's odds per card (pack odds are shown in the store), and its guarantee if it has one. */
export function PackOdds({ pack }: { pack: PackOddsValues & { guaranteedRarity: string | null } }) {
  const rows = packOddsRows(pack);
  const guaranteed = RARITY_ORDER.find((rarity) => rarity === pack.guaranteedRarity) ?? null;
  return (
    <div className="space-y-2">
      <table className="text-footnote w-full">
        <caption className="text-subhead text-label pb-1 text-left">Odds for each card</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rarity}>
              <th scope="row" className="py-0.5 text-left font-normal">
                <RarityMark rarity={row.rarity} />
              </th>
              <td className="text-right tabular-nums">{formatOdds(row.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {guaranteed && (
        <p className="text-footnote text-label-secondary">{guaranteeLine(guaranteed)}</p>
      )}
    </div>
  );
}
