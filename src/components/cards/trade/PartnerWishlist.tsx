"use client";

import { usePartnerWishlist } from "~/hooks/cards/useTradeBuilder";

/** What the partner wants, shown while you build a trade with them. */
export function PartnerWishlist({ partnerId, handle }: { partnerId: string; handle: string }) {
  const { data } = usePartnerWishlist(partnerId);
  if (!data || data.length === 0) return null;

  return (
    <section aria-label={`@${handle} wants`} className="space-y-1">
      <h3 className="text-headline">@{handle} wants</h3>
      <ul className="text-footnote text-label-secondary space-y-0.5">
        {data.slice(0, 12).map((w) => (
          <li key={w.cardId}>
            {w.title}
            {w.youOwn > 0 ? ` · you have ${w.youOwn}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
