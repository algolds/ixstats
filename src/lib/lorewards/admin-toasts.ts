/**
 * What the admin's "Pay now" (`lorewards.payNow`) and "Run full sync" (`lorewards.triggerSync`) say once they finish:
 * the places paid and the trophy cards minted and given, or that nothing was paid while Loreward bonuses are off.
 */
import type { SettleResult } from "./settle";

export interface AdminToast {
  tone: "success" | "warning";
  title: string;
  message: string;
}

const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const places = (count: number) => counted(count, "place", "places");
const trophyCards = (count: number) => counted(count, "trophy card", "trophy cards");

const BONUSES_OFF = "Nothing was paid. Turn bonuses on in Economy, then pay again.";

/** " The ledger refused 2; they are paid on the next sync." when the ledger refused places, else empty. */
const refusedNote = ({ refused }: SettleResult) =>
  refused > 0 ? ` The ledger refused ${refused}; they are paid on the next sync.` : "";

export function payNowToast(result: SettleResult): AdminToast {
  const cards = `${trophyCards(result.minted)} minted, ${result.granted} given.`;
  if (!result.payoutsEnabled) {
    return {
      tone: "warning",
      title: "Loreward bonuses are off",
      message: `${BONUSES_OFF} ${cards}`,
    };
  }
  return {
    tone: "success",
    title: "Loreward places paid",
    message: `${places(result.paid)} paid. ${cards}${refusedNote(result)}`,
  };
}

export function fullSyncToast(result: { oolEntries: number; settled: SettleResult }): AdminToast {
  const { settled } = result;
  const read = `${counted(result.oolEntries, "entry", "entries")} read from the OOL pages.`;
  const minted = `${trophyCards(settled.minted)} minted.`;
  const paid = settled.payoutsEnabled
    ? `${places(settled.paid)} paid, ${minted}${refusedNote(settled)}`
    : `${BONUSES_OFF} ${minted}`;
  return {
    tone: settled.payoutsEnabled ? "success" : "warning",
    title: "Lorewards synced",
    message: `${read} ${paid}`,
  };
}
