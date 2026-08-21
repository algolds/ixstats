"use client";

import React from "react";
import { motion } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { SwipeableRow, SwipeActionButton } from "~/components/ui/facet/swipeable";
import { cn } from "~/lib/utils";
import type { NotificationItem } from "./types";

export interface NotificationRowProps {
  n: NotificationItem;
  isRead: boolean;
  colors: { bg: string; text: string };
  Icon: React.ComponentType<{ className?: string }>;
  handleMarkRead: (n: NotificationItem) => void;
  handleDismiss: (n: NotificationItem) => void;
  handleClick: (n: NotificationItem) => void;
  relativeTime: (ts: string | number | Date) => string;
  isExpanded: boolean;
  onExpandToggle: () => void;
}

export function NotificationRow({
  n,
  isRead,
  colors,
  Icon,
  handleMarkRead,
  handleDismiss,
  handleClick,
  relativeTime: relTime,
  isExpanded,
  onExpandToggle,
}: NotificationRowProps) {
  return (
    <SwipeableRow
      id={`notif-${n.source}-${n.id}`}
      className="mb-1.5 rounded-xl last:mb-0"
      springPreset="bouncy"
      expanded={isExpanded}
      onExpandedChange={(expanded) => {
        if (expanded !== isExpanded) onExpandToggle();
      }}
    >
      {/* Leading actions (swipe right -> open) */}
      {n.href && (
        <SwipeableRow.Leading
          commit={{ action: () => handleClick(n), label: "Open", color: "#22c55e" }}
        >
          <SwipeActionButton
            id="open"
            icon={ChevronRight}
            label="Open"
            onClick={() => handleClick(n)}
            color="#22c55e"
          />
        </SwipeableRow.Leading>
      )}

      {/* Trailing actions (swipe left -> dismiss) */}
      <SwipeableRow.Trailing
        commit={{ action: () => handleDismiss(n), label: "Clear", color: "#ef4444" }}
      >
        {n.href && (
          <SwipeActionButton
            id="open-trailing"
            icon={ChevronRight}
            label="Open"
            onClick={() => handleClick(n)}
            color="#3b82f6"
          />
        )}
        <SwipeActionButton
          id="clear"
          icon={X}
          label="Clear"
          onClick={() => handleDismiss(n)}
          color="#ef4444"
        />
      </SwipeableRow.Trailing>

      {/* Front card content */}
      <SwipeableRow.Content>
        <div
          className={cn(
            "relative flex w-full flex-col overflow-hidden rounded-xl border backdrop-blur-xl transition-all duration-200",
            !isRead
              ? "border-blue-500/40 bg-blue-500/[0.08] shadow-xs hover:border-blue-500/60"
              : "border-border/50 bg-card/60 hover:border-border hover:bg-card/90 opacity-85 hover:opacity-100"
          )}
        >
          {/* Left Accent Border Strip */}
          <div
            className={cn(
              "absolute top-0 bottom-0 left-0 w-[3px] rounded-l-xl transition-all duration-300",
              colors.text.replace("text-", "bg-"),
              isRead ? "opacity-30" : "opacity-100"
            )}
          />

          {/* Header Content */}
          <div className="flex cursor-grab items-center gap-3 p-3 text-left hover:bg-accent/5 active:cursor-grabbing">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/5 shadow-2xs",
                colors.bg
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", colors.text)} />
            </div>

            <div className="min-w-0 flex-1 pl-0.5">
              <div className="flex items-center gap-2">
                <span className="text-foreground block truncate text-xs font-semibold">{n.title}</span>
                {!isRead && (
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-500 shadow-xs shadow-blue-500/50" />
                )}
              </div>
              {!isExpanded && (n.description || n.message) && (
                <span className="text-muted-foreground mt-0.5 block truncate text-[11px] leading-relaxed font-medium">
                  {n.description || n.message}
                </span>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-muted-foreground/70 text-[9px] font-medium tabular-nums">
                {relTime(n.timestamp || n.createdAt || Date.now())}
              </span>
              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronRight className="text-muted-foreground/60 h-3.5 w-3.5" />
              </motion.div>
            </div>
          </div>
        </div>
      </SwipeableRow.Content>

      {/* Expanded detail panel */}
      <SwipeableRow.Expanded>
        <div className="space-y-3 rounded-b-xl border-t border-border/30 bg-accent/5 px-3.5 pt-3 pb-3.5 pl-[18px]">
          <p className="text-foreground/95 text-[11.5px] leading-relaxed font-medium whitespace-pre-wrap select-text selection:bg-blue-500/30">
            {n.description || n.message}
          </p>

          <div className="flex items-center gap-2 pt-1.5">
            {n.href && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(n);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-blue-400/20 bg-blue-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-xs transition-all hover:bg-blue-600 active:scale-[0.98]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Open</span>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(n);
              }}
              className="text-muted-foreground hover:text-foreground flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/50 bg-accent/10 px-3 py-1.5 text-[10px] font-bold transition-all hover:bg-accent/20 active:scale-[0.98]"
            >
              <X className="text-muted-foreground/60 h-3.5 w-3.5" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </SwipeableRow.Expanded>
    </SwipeableRow>
  );
}
