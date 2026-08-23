"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Search, Cart as ShoppingCart, Calendar } from "iconoir-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

export function VaultPurchaseLogs() {
  const { data: logs, isLoading } = api.vault.adminGetPurchaseLogs.useQuery();
  const [search, setSearch] = useState("");

  const filteredLogs = (logs || []).filter((log) => {
    const term = search.toLowerCase();
    return (
      log.user.displayName.toLowerCase().includes(term) ||
      log.source.toLowerCase().includes(term) ||
      log.itemId.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-foreground text-lg font-bold">Store Purchase Ledger</h3>
          <p className="text-muted-foreground text-xs">
            Review detailed audits of all user credit expenditures on cosmetics and upgrades.
          </p>
        </div>

        {/* Filter input */}
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Filter by user or item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background/50 border-border/50 focus-visible:ring-primary/30 pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-muted-foreground border-border/40 bg-card/25 rounded-xl border py-12 text-center">
          {search ? "No matches found." : "No purchases recorded."}
        </div>
      ) : (
        <div className="border-border/40 bg-card/10 overflow-hidden rounded-xl border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Purchaser</TableHead>
                <TableHead>Purchased Item Details</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price Paid</TableHead>
                <TableHead className="text-right">Transaction Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const isUpgrade = log.type === "SPEND_BOOST" || log.itemId.includes("upgrade");
                return (
                  <TableRow key={log.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.user.flag && (
                          <img
                            src={log.user.flag}
                            alt=""
                            className="h-4 w-6 shrink-0 rounded-sm object-cover"
                          />
                        )}
                        <span
                          className="text-foreground font-semibold"
                          title={`ID: ${log.user.id}`}
                        >
                          {log.user.displayName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="font-medium text-slate-100">
                          {log.source.replace("Purchase item: ", "")}
                        </span>
                      </div>
                      <div className="text-muted-foreground font-mono text-[9px]">
                        ID: {log.itemId}
                      </div>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-red-400">
                      <span className="inline-flex items-center gap-0.5">
                        -<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {Math.abs(log.credits).toLocaleString()} IxC
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-[10px]">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
