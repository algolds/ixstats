import { IxCreditsSymbol } from "../../IxCreditsSymbol";

export const formatCredits = (amount: number) => Math.round(amount).toLocaleString();

/** An IxCredits amount with the currency mark; `prefix` is "+" or "~" for projected figures. */
export function Credits({
  amount,
  prefix = "",
  symbolClassName = "size-3",
}: {
  amount: number;
  prefix?: string;
  symbolClassName?: string;
}) {
  return (
    <>
      {prefix}
      <IxCreditsSymbol decorative className={`${symbolClassName} shrink-0`} />
      {formatCredits(amount)}
    </>
  );
}
