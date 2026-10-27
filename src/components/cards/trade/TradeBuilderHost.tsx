"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TradeBuilderSheet } from "./TradeBuilderSheet";

export interface TradeAddress {
  trade: string;
  partner?: string | null;
  give?: string | null;
  get?: string | null;
}

interface TradeBuilderHostProps {
  address?: TradeAddress | null;
  onClose?: () => void;
}

/** Opens the trade builder from props or URL (?trade=new or ?trade=<id>). */
export function TradeBuilderHost({ address, onClose }: TradeBuilderHostProps) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Controlled mode via props (used by CardsHub / MarketPane)
  if (address !== undefined) {
    if (!address) return null;
    return (
      <TradeBuilderSheet
        key={address.trade}
        open
        onOpenChange={(open) => !open && onClose?.()}
        tradeId={address.trade === "new" ? undefined : address.trade}
        seed={
          address.trade === "new"
            ? {
                partnerHandle: address.partner ?? undefined,
                give: address.give ? [address.give] : [],
                get: address.get ? [address.get] : [],
              }
            : undefined
        }
      />
    );
  }

  // Uncontrolled mode via URL search parameters
  const trade = params?.get("trade") ?? null;
  if (!trade) return null;

  const handleClose = () => {
    const next = new URLSearchParams(params?.toString());
    for (const key of ["trade", "partner", "give", "get"]) next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const seed = {
    partnerHandle: params?.get("partner") ?? undefined,
    give: params?.getAll("give") ?? [],
    get: params?.getAll("get") ?? [],
  };

  return (
    <TradeBuilderSheet
      key={trade}
      open
      onOpenChange={(open) => !open && handleClose()}
      tradeId={trade === "new" ? undefined : trade}
      seed={trade === "new" ? seed : undefined}
    />
  );
}
