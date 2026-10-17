"use client";
/** The Loreward payout grid: credits per contest and place, which had no editor before. */
import { useState } from "react";
import { Trophy } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  LOREWARD_PLACE_LABELS,
  lorewardContestLabel,
  lorewardPayoutField,
  numberFieldProblem,
} from "~/lib/cards/economy-fields";
import { LOREWARD_PLACES, LOREWARD_TYPES } from "~/lib/vault/loreward-places";
import { fieldNumber } from "./NumberConfigCard";

type Payouts = RouterOutputs["cards"]["admin"]["economy"]["get"]["lorewardPayouts"];

const CELLS = LOREWARD_TYPES.flatMap((type) =>
  LOREWARD_PLACES.map((place) => ({ type, place, field: lorewardPayoutField(type, place) }))
);

export function LorewardPayoutsCard({ initial }: { initial: Payouts }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [draft, setDraft] = useState<Partial<Record<string, string>>>({});
  const save = api.cards.admin.economy.saveLorewardPayouts.useMutation({
    onSuccess: () => {
      notify.success("Loreward payouts saved");
      void utils.cards.admin.economy.get.invalidate();
    },
    onError: (error) => notify.error("Payouts not saved", error.message),
  });

  const cells = CELLS.map((cell) => {
    const raw = draft[cell.field.key] ?? String(initial[cell.type][cell.place]);
    const credits = fieldNumber(raw);
    const problemId = `payout-${cell.type}-${cell.place}-problem`;
    return { ...cell, raw, credits, problemId, problem: numberFieldProblem(cell.field, credits) };
  });
  const invalid = cells.filter((cell) => cell.problem !== null);
  const changed = cells
    .filter((cell) => cell.credits !== initial[cell.type][cell.place])
    .map(({ type, place, credits }) => ({ type, place, credits }));

  return (
    <Card content="input">
      <CardHeader className="pt-5">
        <CardTitle icon={<Trophy />}>Loreward payouts</CardTitle>
        <CardDescription>
          Each contest&apos;s winner and runner-up are paid these credits from the next payout on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contest</TableHead>
              {LOREWARD_PLACES.map((place) => (
                <TableHead key={place}>{LOREWARD_PLACE_LABELS[place]} (IxC)</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {LOREWARD_TYPES.map((type) => (
              <TableRow key={type}>
                <TableCell>{lorewardContestLabel(type)}</TableCell>
                {cells
                  .filter((cell) => cell.type === type)
                  .map((cell) => (
                    <TableCell key={cell.place}>
                      <Input
                        aria-label={cell.field.label}
                        aria-invalid={cell.problem !== null}
                        aria-describedby={cell.problem ? cell.problemId : undefined}
                        type="number"
                        min={cell.field.min}
                        max={cell.field.max}
                        step={1}
                        value={cell.raw}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [cell.field.key]: event.target.value,
                          }))
                        }
                        className="tabular-nums"
                      />
                    </TableCell>
                  ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {invalid.map((cell) => (
          <p key={cell.problemId} id={cell.problemId} className="text-destructive text-footnote">
            {cell.problem}
          </p>
        ))}
        <Button
          disabled={save.isPending || invalid.length > 0 || changed.length === 0}
          onClick={() => save.mutate(changed)}
        >
          Save payouts
        </Button>
      </CardContent>
    </Card>
  );
}
