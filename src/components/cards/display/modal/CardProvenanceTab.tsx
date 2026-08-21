"use client";

import React from "react";
import { motion } from "motion/react";
import { History, Package, Award, Gift, ArrowRightLeft, ShoppingBag, Star } from "lucide-react";
import { cn } from "~/lib/utils";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

export interface TransferEvent {
  id: string;
  action: string;
  fromUserName?: string | null;
  toUserName?: string | null;
  price?: number | null;
  createdAt: string | Date;
}

export function CardProvenanceTab({
  isLoading,
  events,
}: {
  isLoading: boolean;
  events?: TransferEvent[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="glass-hierarchy-child rounded-lg p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
          <History className="h-5 w-5" />
          Provenance Timeline
        </h3>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            No ownership transfer events found
          </div>
        ) : (
          <div className="relative ml-3 space-y-6 border-l border-slate-200 pl-6 dark:border-white/10">
            {events.map((event) => {
              let icon = <Package className="h-4 w-4 text-white" />;
              let actionLabel: React.ReactNode = "Transferred";
              let colorClass = "bg-blue-500";

              if (event.action === "PACK_OPEN") {
                icon = <Package className="h-4 w-4 text-white" />;
                actionLabel = "Pulled from Card Pack";
                colorClass = "bg-purple-500";
              } else if (event.action === "DAILY_CLAIM") {
                icon = <Award className="h-4 w-4 text-white" />;
                actionLabel = "Claimed as Daily Bonus";
                colorClass = "bg-yellow-500";
              } else if (event.action === "GIFT") {
                icon = <Gift className="h-4 w-4 text-white" />;
                actionLabel = event.fromUserName
                  ? `Gifted from ${event.fromUserName} to ${event.toUserName}`
                  : `Gifted to ${event.toUserName}`;
                colorClass = "bg-pink-500";
              } else if (event.action === "TRADE") {
                icon = <ArrowRightLeft className="h-4 w-4 text-white" />;
                actionLabel = event.fromUserName
                  ? `Traded from ${event.fromUserName} to ${event.toUserName}`
                  : `Traded to ${event.toUserName}`;
                colorClass = "bg-teal-500";
              } else if (event.action === "AUCTION_BUYOUT" || event.action === "AUCTION_END") {
                icon = <ShoppingBag className="h-4 w-4 text-white" />;
                actionLabel = (
                  <span className="inline-flex items-center gap-1">
                    Purchased at Auction by {event.toUserName}
                    {event.price && (
                      <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
                        for <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {event.price.toLocaleString()}
                      </span>
                    )}
                  </span>
                );
                colorClass = "bg-amber-500";
              } else if (event.action === "ADMIN") {
                icon = <Star className="h-4 w-4 text-white" />;
                actionLabel = `Assigned by Admin to ${event.toUserName}`;
                colorClass = "bg-red-500";
              }

              return (
                <div key={event.id} className="relative flex flex-col items-start gap-1 text-left">
                  {/* Dot Indicator */}
                  <div
                    className={cn(
                      "absolute top-0.5 -left-[37px] flex h-6 w-6 items-center justify-center rounded-full shadow-md",
                      colorClass
                    )}
                  >
                    {icon}
                  </div>
                  <div className="text-foreground text-sm font-semibold">{actionLabel}</div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(event.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
