"use client";

import { ViewGrid } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { DOMAIN_LABELS } from "~/lib/military/model";
import { worstSubScore } from "~/lib/military/defense-console";
import type { OwnerBranch } from "~/hooks/useDefenseConsole";
import { C_LEVEL_COPY, SUB_SCORE_COPY } from "../defense-copy";
import { formatCount } from "../forces/force-fields";

/** Each branch's rating, its weakest area and its share of national combat power. */
export function BranchReadinessTable({ branches }: { branches: readonly OwnerBranch[] }) {
  if (branches.length === 0) return null;
  return (
    <Card content="data">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<ViewGrid />}>Branches</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3 sm:px-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="hidden sm:table-cell">Weakest area</TableHead>
              <TableHead className="text-right">Personnel</TableHead>
              <TableHead className="text-right">Combat power</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="text-label font-medium">{b.name}</div>
                  <div className="text-label-secondary text-footnote">
                    {DOMAIN_LABELS[b.domain]}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    {b.cLevel} · {C_LEVEL_COPY[b.cLevel].label}
                  </div>
                  <Progress
                    value={b.readiness * 100}
                    className="mt-1.5 h-1 max-w-28"
                    aria-label={`${b.name} readiness`}
                  />
                </TableCell>
                <TableCell className="text-label-secondary hidden sm:table-cell">
                  {SUB_SCORE_COPY[worstSubScore(b.subScores)].label}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(b.personnel)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(b.combatPower)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
