import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Skeleton } from "~/components/ui/skeleton";

export const formatCredits = (amount: number) => Math.round(amount).toLocaleString();

/** A figure that may still be loading (undefined) or have failed (null). */
export type Figure = number | null | undefined;

/** The figure when both are known; null if either failed, undefined while either loads. */
export function sumFigures(a: Figure, b: Figure): Figure {
  if (a === null || b === null) return null;
  if (a === undefined || b === undefined) return undefined;
  return a + b;
}

/** An IxCredits amount with the currency mark; `animate` counts the figure up or down when it changes. */
export function Credits({
  amount,
  symbolClassName = "size-3",
  animate = false,
}: {
  amount: number;
  symbolClassName?: string;
  animate?: boolean;
}) {
  return (
    <>
      <IxCreditsSymbol decorative className={`${symbolClassName} shrink-0`} />
      {animate ? (
        <NumberFlowDisplay value={Math.round(amount)} className="font-semibold" />
      ) : (
        formatCredits(amount)
      )}
    </>
  );
}

/** A `Figure` as credits: a skeleton while it loads, a dash when it is unavailable. */
export function CreditsFigure({
  amount,
  symbolClassName,
  skeletonClassName = "h-8 w-28",
  animate = false,
}: {
  amount: Figure;
  symbolClassName?: string;
  skeletonClassName?: string;
  animate?: boolean;
}) {
  if (amount === undefined) return <Skeleton as="span" className={skeletonClassName} />;
  if (amount === null) return <span aria-label="Unavailable">–</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Credits amount={amount} symbolClassName={symbolClassName} animate={animate} />
    </span>
  );
}
