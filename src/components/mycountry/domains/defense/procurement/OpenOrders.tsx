"use client";

import React, { useState } from "react";
import { DeliveryTruck } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { orderPaidShare, orderSlipMonths } from "~/lib/military/defense-console";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import type { ProcurementOrderRow } from "~/hooks/useDefenseConsole";
import { formatWhen } from "../clock-text";
import { formatCount, formatPercent } from "../forces/force-fields";

interface OpenOrdersProps {
  orders: readonly ProcurementOrderRow[];
  branchNames: ReadonlyMap<string, string>;
  reader: RealmClockReader | null;
  nowClockMs: number;
  canEdit: boolean;
  onCancel: (orderId: string) => void;
}

/** Orders in production: payments so far, delivery on the realm calendar, slips, and cancelling. */
export function OpenOrders({ orders, branchNames, reader, nowClockMs, canEdit, onCancel }: OpenOrdersProps) {
  const [cancelling, setCancelling] = useState<ProcurementOrderRow | null>(null);
  return (
    <Card content="data">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<DeliveryTruck />}>Open orders</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {orders.length === 0 ? (
          <p className="text-label-secondary text-callout">
            No orders in production. Order equipment from the catalog below.
          </p>
        ) : (
          <ul className="divide-separator divide-y">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                branch={branchNames.get(order.branchId) ?? "Branch"}
                reader={reader}
                nowClockMs={nowClockMs}
                canEdit={canEdit}
                onCancel={() => setCancelling(order)}
              />
            ))}
          </ul>
        )}
      </CardContent>
      <AlertDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel the order for {cancelling?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The {formatCompactCurrency(cancelling?.paidSoFar ?? 0)} paid so far is sunk and not
              refunded. Nothing is delivered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the order</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (cancelling) onCancel(cancelling.id);
                setCancelling(null);
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function OrderRow({
  order,
  branch,
  reader,
  nowClockMs,
  canEdit,
  onCancel,
}: {
  order: ProcurementOrderRow;
  branch: string;
  reader: RealmClockReader | null;
  nowClockMs: number;
  canEdit: boolean;
  onCancel: () => void;
}) {
  const slip = orderSlipMonths(order);
  const paid = orderPaidShare(order);
  return (
    <li className="space-y-2 py-3" data-testid="open-order">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-callout text-label font-medium">
              {formatCount(order.quantity)} × {order.name}
            </span>
            <Badge variant="outline">{order.source === "import" ? "Import" : "Domestic"}</Badge>
            {slip > 0 && (
              <Badge variant="warning">
                Slipped {slip} {slip === 1 ? "month" : "months"}
              </Badge>
            )}
          </div>
          <div className="text-label-secondary text-footnote tabular-nums">
            {branch} · delivery {formatWhen(order.expectedClockMs, nowClockMs, reader)}
          </div>
        </div>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={onCancel} aria-label={`Cancel the order for ${order.name}`}>
            Cancel
          </Button>
        )}
      </div>
      <Progress value={paid * 100} className="h-1" aria-label={`${order.name} paid`} />
      <p className="text-label-secondary text-footnote tabular-nums">
        {formatCompactCurrency(order.paidSoFar)} of {formatCompactCurrency(order.totalCost)} paid (
        {formatPercent(paid)})
        {slip > 0 && ". The procurement line fell short, so delivery moved and the price rose 0.5% a month"}
      </p>
    </li>
  );
}
