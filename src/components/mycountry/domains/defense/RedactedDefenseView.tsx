"use client";

import React from "react";
import { EyeClosed, Shield } from "iconoir-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { DOMAIN_LABELS } from "~/lib/military/model";
import type { RedactedDefense } from "~/hooks/useDefenseConsole";
import { ALERT_COPY, DOCTRINE_COPY } from "./defense-copy";
import { formatCount } from "./forces/force-fields";

/** Another nation's defense: its public order of battle and visible posture, nothing of its internals. */
export function RedactedDefenseView({ view }: { view: RedactedDefense }) {
  return (
    <div className="space-y-4">
      <Card content="data">
        <CardHeader className="p-5 pb-3">
          <CardTitle icon={<Shield />}>Public order of battle</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <EyeClosed aria-hidden="true" className="h-4 w-4 shrink-0" />
            Readiness, equipment and budget are known only to this nation. Others see them as
            intelligence estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-5">
          <div className="grid grid-cols-2 gap-4">
            <Stat size="sm" label="Doctrine" value={DOCTRINE_COPY[view.doctrine].label} />
            <Stat size="sm" label="Alert in effect" value={ALERT_COPY[view.alertInEffect].label} />
          </div>
          {view.branches.length === 0 ? (
            <p className="text-label-secondary text-callout">No military branches on record.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Reserves</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-label font-medium">{b.name}</TableCell>
                    <TableCell className="text-label-secondary">{DOMAIN_LABELS[b.domain]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(b.active)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCount(b.reserves)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
