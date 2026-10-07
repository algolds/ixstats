"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { AUTO_LINK_MIN_CONFIDENCE, type MatchReason } from "~/lib/maps/nation-name-matching";

const REASON_LABELS: Record<MatchReason, string> = {
  exact: "Same name",
  normalized: "Same name, other spelling",
  "state-form": "Same name without its state form",
  similar: "Similar spelling",
};

const pairKey = (featureId: string, countryId: string) => `${featureId}\u0000${countryId}`;

/**
 * Auto-Match's review list: each unlinked region of the edited realm with the nation its name points to and how
 * sure the match is. Confident matches start ticked, similar spellings unticked; several regions may go to one
 * nation. Nothing is linked until "Link selected", which hands the picked pairs to `onLink`.
 */
export function AutoMatchReviewDialog({
  realm,
  open,
  onOpenChange,
  onLink,
  isLinking,
}: {
  realm: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLink: (matches: Array<{ featureId: string; countryId: string }>) => void;
  isLinking: boolean;
}) {
  const { data, isLoading, error } = api.geoEditor.suggestLinkageMatches.useQuery(
    { realm },
    { enabled: open, staleTime: 0, retry: false }
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const suggestions = data?.suggestions ?? [];

  useEffect(() => {
    if (!data) return;
    setSelected(
      new Set(
        data.suggestions
          .filter((s) => s.confidence >= AUTO_LINK_MIN_CONFIDENCE)
          .map((s) => pairKey(s.featureId, s.countryId))
      )
    );
  }, [data]);

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const chosen = suggestions.filter((s) => selected.has(pairKey(s.featureId, s.countryId)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Auto-Match regions to nations</DialogTitle>
          <DialogDescription>
            Matched by name, ignoring case, accents, hyphens and state forms like "Republic of", and
            by the roster's nation pages and source keys. Check each match before linking it.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-label-secondary text-footnote">Matching…</p>
        ) : error ? (
          <p className="text-destructive text-footnote">{error.message}</p>
        ) : suggestions.length === 0 ? (
          <p className="text-label-secondary text-footnote">
            No unlinked region matches a nation{data ? ` (${data.unlinkedRegions} unlinked)` : ""}.
          </p>
        ) : (
          <ul
            className="flex max-h-80 flex-col gap-1 overflow-y-auto"
            aria-label="Suggested matches"
          >
            {suggestions.map((s) => {
              const key = pairKey(s.featureId, s.countryId);
              const id = `match-${s.featureId}`;
              return (
                <li key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={selected.has(key)}
                    onCheckedChange={(v) => toggle(key, v === true)}
                  />
                  <label htmlFor={id} className="text-footnote flex min-w-0 flex-1 flex-col">
                    <span className="text-label truncate">
                      {s.featureName} to {s.countryName}
                    </span>
                    <span className="text-label-secondary truncate">
                      {REASON_LABELS[s.reason]}
                      {s.matchedOn !== s.countryName ? ` ("${s.matchedOn}")` : ""}
                    </span>
                  </label>
                  <span className="text-label-secondary text-footnote tabular-nums">
                    {Math.round(s.confidence * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={chosen.length === 0 || isLinking}
            onClick={() => {
              onLink(chosen.map((s) => ({ featureId: s.featureId, countryId: s.countryId })));
              onOpenChange(false);
            }}
          >
            Link selected ({chosen.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
