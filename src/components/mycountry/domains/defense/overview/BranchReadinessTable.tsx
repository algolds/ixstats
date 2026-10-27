"use client";

import React from "react";
import { ViewGrid } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { SUB_SCORE_COPY } from "../defense-copy";
import { formatCount, formatPercent } from "../forces/force-fields";

/** Each branch's rating, its weakest area and its share of national combat power. */
export const BranchReadinessTable = React.memo(function BranchReadinessTable({
  branches,
}: {
  branches: readonly OwnerBranch[];
}) {
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
                  <div className="text-label-secondary text-footnote">{DOMAIN_LABELS[b.domain]}</div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {b.cLevel} · {formatPercent(b.readiness)}
                </TableCell>
                <TableCell className="text-label-secondary hidden sm:table-cell">
                  {SUB_SCORE_COPY[worstSubScore(b.subScores)].label}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(b.personnel)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(b.combatPower)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
