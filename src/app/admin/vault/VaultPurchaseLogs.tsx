"use client";

import React, { useMemo } from "react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Cart as ShoppingCart, Calendar } from "iconoir-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { FacetDataTable, type FacetColumn } from "~/components/ui/data-table";

interface PurchaseLog {
  id: string;
  credits: number;
  balanceAfter: number;
  type: string;
  source: string;
  itemId: string;
  createdAt: Date | string;
  user: {
    id?: string;
    displayName: string;
    flag?: string | null;
  };
}

export function VaultPurchaseLogs() {
  const { data: logs = [], isLoading } = api.vault.adminGetPurchaseLogs.useQuery();

  const columns = useMemo<FacetColumn<PurchaseLog>[]>(
    () => [
      {
        key: "purchaser",
        header: "Purchaser",
        mobileRole: "hero",
        accessor: (log: PurchaseLog) => log.user.displayName,
        render: (_val: unknown, log: PurchaseLog) => (
          <div className="flex items-center gap-2">
            {log.user.flag && (
              <img
                src={log.user.flag}
                alt=""
                className="h-4 w-6 shrink-0 rounded-sm object-cover"
              />
            )}
            <span className="text-foreground font-semibold" title={`ID: ${log.user.id}`}>
              {log.user.displayName}
            </span>
          </div>
        ),
      },
      {
        key: "item",
        header: "Purchased Item Details",
        mobileRole: "field",
        mobileLabel: "Item",
        accessor: (log: PurchaseLog) => log.source,
        render: (_val: unknown, log: PurchaseLog) => (
          <div>
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="text-muted-foreground h-3.5 w-3.5" />
              <span className="font-medium text-foreground">
                {log.source.replace("Purchase item: ", "")}
              </span>
            </div>
            <div className="text-muted-foreground font-mono text-[9px]">ID: {log.itemId}</div>
          </div>
        ),
      },
      {
        key: "category",
        header: "Category",
        mobileRole: "badge",
        accessor: (log: PurchaseLog) => (log.type === "SPEND_BOOST" || log.itemId.includes("upgrade") ? "Upgrade" : "Cosmetic"),
        render: (_val: unknown, log: PurchaseLog) => {
          const isUpgrade = log.type === "SPEND_BOOST" || log.itemId.includes("upgrade");
          return (
            <Badge
              variant="outline"
              className={`px-1.5 py-0 text-[9px] uppercase ${
                isUpgrade
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                  : "border-purple-500/20 bg-purple-500/5 text-purple-400"
              }`}
            >
              {isUpgrade ? "Upgrade" : "Cosmetic"}
            </Badge>
          );
        },
      },
      {
        key: "price",
        header: "Price Paid",
        align: "right",
        sortable: true,
        mobileRole: "badge",
        accessor: (log: PurchaseLog) => Math.abs(log.credits),
        render: (_val: unknown, log: PurchaseLog) => (
          <span className="inline-flex items-center gap-0.5 font-mono font-bold text-rose-400">
            -<IxCreditsSymbol className="h-3 w-3 shrink-0" />
            {Math.abs(log.credits).toLocaleString()} IxC
          </span>
        ),
      },
      {
        key: "createdAt",
        header: "Transaction Date",
        align: "right",
        sortable: true,
        mobileRole: "footer",
        accessor: (log: PurchaseLog) => new Date(log.createdAt).getTime(),
        render: (_val: unknown, log: PurchaseLog) => (
          <div className="text-muted-foreground flex items-center justify-end gap-1 font-mono text-[10px]">
            <Calendar className="h-3 w-3" />
            {new Date(log.createdAt).toLocaleString()}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <FacetDataTable
      data={(logs as unknown as PurchaseLog[]) || []}
      columns={columns}
      title="Store Purchase Ledger"
      description="Review detailed audits of all user credit expenditures on cosmetics and upgrades."
      searchable
      searchPlaceholder="Filter by user or item..."
      searchKeys={["source", "itemId"]}
      paginated
      pageSize={15}
      loading={isLoading}
      emptyMessage="No purchases recorded."
      exportable
      exportFilename="vault-purchase-ledger.csv"
      className="space-y-6"
    />
  );
}
