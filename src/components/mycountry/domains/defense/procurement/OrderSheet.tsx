"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import type { OrderSource } from "~/lib/military/model";
import { defaultOrderBranch, domesticBlock, fitsDomain, quoteOrder } from "~/lib/military/defense-console";
import type { EquipmentPreset } from "~/lib/military/player-catalog";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import type { OwnerDefense } from "~/hooks/useDefenseConsole";
import { formatWhen } from "../clock-text";

export interface OrderInput {
  branchId: string;
  catalogKey: string;
  quantity: number;
  source: OrderSource;
}

interface OrderSheetProps {
  item: EquipmentPreset | null;
  overview: OwnerDefense;
  reader: RealmClockReader | null;
  nowClockMs: number;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onPlace: (order: OrderInput) => void;
}

const MAX_QUANTITY = 10_000;

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-label-secondary text-callout">{label}</dt>
      <dd className="text-label text-callout text-right tabular-nums">{value}</dd>
    </div>
  );
}

const BLOCK_TEXT = {
  frontier: "This design is newer than your industry can build. Import it, or fund research to close the gap.",
  capacity: "Domestic industry cannot take this order on top of the ones it has. Import it, order fewer, or start a production surge.",
} as const;

/** Order catalog equipment for a branch: built at home or imported, with its price, payments and delivery date. */
export function OrderSheet({ item, overview, reader, nowClockMs, pending, onOpenChange, onPlace }: OrderSheetProps) {
  const branches = item ? overview.branches.filter((b) => fitsDomain(item.catalogCategory, b.domain)) : [];
  const [branchId, setBranchId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [source, setSource] = useState<OrderSource>("domestic");
  const branch =
    branches.find((b) => b.id === branchId) ?? defaultOrderBranch(item?.catalogCategory, branches);

  const quote = quoteOrder({
    catalogCost: item?.acquisitionCost ?? 0,
    subcategory: item?.subcategory,
    era: item?.era,
    quantity,
    source,
    priceIndex: overview.policy.priceIndex,
    surging: overview.policy.surging,
    nowClockMs,
  });
  const block = source === "domestic" ? domesticBlock({ quote, ...overview.procurement }) : null;

  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Order {item?.name}</SheetTitle>
          <SheetDescription>
            Paid 15% at order and the rest monthly from the procurement line until delivery. If the
            line runs short, the order slips a month and costs 0.5% more.
          </SheetDescription>
        </SheetHeader>
        {branches.length === 0 ? (
          <p className="text-label-secondary text-callout">
            None of your branches can hold this equipment.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="order-branch">For branch</Label>
              <Select value={branch?.id} onValueChange={setBranchId}>
                <SelectTrigger id="order-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-quantity">Quantity</Label>
              <Input
                id="order-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_QUANTITY}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(e.target.value) || 1))))
                }
                className="w-32 tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <div className="text-subhead text-label font-medium">Source</div>
              <SegmentedControl<OrderSource>
                aria-label="Source"
                size="sm"
                value={source}
                onValueChange={setSource}
                options={[
                  { value: "domestic", label: "Build at home" },
                  { value: "import", label: "Import" },
                ]}
              />
              <p className="text-label-secondary text-footnote">
                {source === "import"
                  ? "Imports cost 15% more and take half as long again, but need no domestic capacity or technology."
                  : "Built within your industry's capacity and technology."}
              </p>
            </div>
            <dl className="bg-fill-4 rounded-row divide-separator divide-y px-4 py-2" aria-label="Order quote">
              <QuoteRow label="Unit cost" value={formatCompactCurrency(quote.unitCost)} />
              <QuoteRow label="Total" value={formatCompactCurrency(quote.total)} />
              <QuoteRow label="Paid at order" value={formatCompactCurrency(quote.downPayment)} />
              <QuoteRow
                label="Then each month"
                value={`${formatCompactCurrency(quote.monthlyPayment)} for ${quote.leadMonths} months`}
              />
              <QuoteRow label="Delivery" value={formatWhen(quote.deliveryClockMs, nowClockMs, reader)} />
            </dl>
            {block && (
              <p role="alert" className="text-warning-ink text-callout">
                {BLOCK_TEXT[block]}
              </p>
            )}
          </div>
        )}
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!item || !branch || block !== null || pending}
            onClick={() => {
              if (item && branch) onPlace({ branchId: branch.id, catalogKey: item.key, quantity, source });
            }}
          >
            {pending ? "Ordering..." : `Order for ${formatCompactCurrency(quote.total)}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
