"use client";

import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { saleFee } from "~/lib/cards/market/fees";
import { isGift, validateTradeTable, type TradeSide } from "~/lib/cards/trade/trade-table";

/** What the table means before you send it: the problem, the gift label, and the fee on credits. */
export function TradeSummary({ give, get }: { give: TradeSide; get: TradeSide }) {
  const { data: numbers } = useEconomyNumbers();
  const table = {
    initiatorCardIds: give.cardIds,
    recipientCardIds: get.cardIds,
    initiatorCredits: give.credits,
    recipientCredits: get.credits,
  };
  const hasContent =
    give.cardIds.length > 0 || get.cardIds.length > 0 || give.credits > 0 || get.credits > 0;
  const problem = hasContent ? validateTradeTable(table) : null;

  const feeGive =
    numbers && give.credits > 0
      ? saleFee(give.credits, {
          ratePct: numbers.feeRatePct,
          threshold: numbers.economy.saleFeeThreshold,
        })
      : 0;

  const feeGet =
    numbers && get.credits > 0
      ? saleFee(get.credits, {
          ratePct: numbers.feeRatePct,
          threshold: numbers.economy.saleFeeThreshold,
        })
      : 0;

  return (
    <div className="text-footnote text-label-secondary space-y-1" aria-live="polite">
      {problem && <p className="text-destructive-ink">{problem}</p>}
      {!problem && isGift(table) && <p>This is a gift: one side gives nothing back.</p>}
      {feeGive > 0 && (
        <p>
          The market fee on your {give.credits.toLocaleString()} IxC is {feeGive.toLocaleString()}{" "}
          IxC, so they receive {(give.credits - feeGive).toLocaleString()} IxC.
        </p>
      )}
      {feeGet > 0 && (
        <p>
          The market fee on the {get.credits.toLocaleString()} IxC you get is{" "}
          {feeGet.toLocaleString()} IxC, so you receive {(get.credits - feeGet).toLocaleString()}{" "}
          IxC.
        </p>
      )}
    </div>
  );
}
