"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import { CardFace } from "~/components/cards/face/CardFace";
import { useTradeables, type TradeableView } from "~/hooks/cards/useTradeBuilder";

interface TradeCardPickerProps {
  partnerId: string;
  side: "mine" | "theirs";
  selected: string[];
  onToggle: (copy: TradeableView) => void;
}

/** Tradeable copies of one side (unlocked, unbound), searchable; wishlist matches are marked. */
export function TradeCardPicker({ partnerId, side, selected, onToggle }: TradeCardPickerProps) {
  const [search, setSearch] = useState("");
  const { data } = useTradeables(partnerId, side, search);
  const target = side === "mine" ? "You give" : "You get";
  const mark = side === "mine" ? "They want this" : "On your wishlist";

  return (
    <div className="space-y-2">
      <SearchField
        size="sm"
        placeholder="Search cards"
        value={search}
        onValueChange={setSearch}
        aria-label={side === "mine" ? "Search your cards" : "Search their cards"}
      />
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {data?.items.map((copy) => {
          const chosen = selected.includes(copy.ownershipId);
          return (
            <li key={copy.ownershipId} className="flex items-center gap-2">
              <CardFace face={copy.face} size="S" className="w-10" />
              <span className="text-callout min-w-0 flex-1 truncate">{copy.face.title}</span>
              {copy.highlighted && <Badge variant="info">{mark}</Badge>}
              <Button
                size="sm"
                variant={chosen ? "secondary" : "ghost"}
                aria-label={`${chosen ? "Remove" : "Add"} ${copy.face.title} ${chosen ? "from" : "to"} ${target}`}
                onClick={() => onToggle(copy)}
              >
                {chosen ? "Added" : "Add"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
