"use client";

import React from "react";
import { motion } from "motion/react";
import { NavArrowRight as ChevronRight, Xmark as X } from "iconoir-react";
import { SwipeableRow, SwipeActionButton } from "~/components/ui/facet/swipeable/SwipeableRow";
import { cn } from "~/lib/utils";
import type { NotificationItem } from "./types";
import { soundEffects } from "~/lib/sound/cuelume";
import { Button } from "~/components/ui/button";

interface NotificationRowProps {
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
  // oxlint-disable-next-line eslint/no-unused-vars
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
      className="rounded-row mb-2 last:mb-0"
      springPreset="bouncy"
      expanded={isExpanded}
      onExpandedChange={(expanded) => {
        if (expanded !== isExpanded) onExpandToggle();
      }}
    >
      {/* Leading actions (swipe right -> open) */}
      {n.href && (
        <SwipeableRow.Leading
          commit={{ action: () => handleClick(n), label: "Open", color: "var(--color-green)" }}
        >
          <SwipeActionButton
            id="open"
            icon={ChevronRight}
            label="Open"
            onClick={() => handleClick(n)}
            color="var(--color-green)"
          />
        </SwipeableRow.Leading>
      )}

      {/* Trailing actions (swipe left -> dismiss) */}
      <SwipeableRow.Trailing
        commit={{
          action: () => {
            soundEffects.droplet();
            handleDismiss(n);
          },
          label: "Clear",
          color: "var(--color-error)",
        }}
      >
        {n.href && (
          <SwipeActionButton
            id="open-trailing"
            icon={ChevronRight}
            label="Open"
            onClick={() => handleClick(n)}
            color="var(--color-yellow)"
          />
        )}
        <SwipeActionButton
          id="clear"
          icon={X}
          label="Clear"
          onClick={() => {
            soundEffects.droplet();
            handleDismiss(n);
          }}
          color="var(--color-error)"
        />
      </SwipeableRow.Trailing>

      {/* Front card content */}
      <SwipeableRow.Content>
        <div
          className={cn(
            "rounded-row relative flex w-full flex-col overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
            !isRead
              ? "border-yellow/30 bg-yellow/6 hover:border-yellow/50"
              : "border-separator bg-fill-4 hover:border-separator-opaque hover:bg-fill-3 opacity-90 hover:opacity-100"
          )}
        >
          {/* Left Accent Border Strip */}
          <div
            className={cn(
              "rounded-l-row absolute top-0 bottom-0 left-0 w-[3px] transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300",
              colors.text.replace("text-", "bg-"),
              isRead ? "opacity-30" : "opacity-100"
            )}
          />

          {/* Header Content */}
          <div className="hover:bg-fill-4 flex cursor-grab items-center gap-3 p-3 text-left active:cursor-grabbing">
            <div
              className={cn(
                "rounded-control border-separator flex h-7 w-7 shrink-0 items-center justify-center border",
                colors.bg
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", colors.text)} />
            </div>

            <div className="min-w-0 flex-1 pl-0.5">
              <div className="flex items-center gap-2">
                <span className="text-label text-caption block truncate font-semibold">
                  {n.title}
                </span>
                {!isRead && (
                  <span className="bg-yellow h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
                )}
              </div>
              {!isExpanded && (n.description || n.message) && (
                <span className="text-label-secondary text-caption mt-0.5 block truncate leading-relaxed">
                  {n.description || n.message}
                </span>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-label-secondary text-caption tabular-nums">
                // oxlint-disable-next-line
                {relTime(n.timestamp || n.createdAt || Date.now())}
              </span>
              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronRight className="text-label-tertiary h-3.5 w-3.5" />
              </motion.div>
            </div>
          </div>
        </div>
      </SwipeableRow.Content>

      {/* Expanded detail panel */}
      <SwipeableRow.Expanded>
        <div className="border-separator bg-fill-4 rounded-b-row space-y-3 border-t px-4 pt-3 pb-4 pl-[18px]">
          <p className="text-label text-caption selection:bg-yellow/30 leading-relaxed whitespace-pre-wrap select-text">
            {n.description || n.message}
          </p>

          <div className="flex items-center gap-2 pt-2">
            {n.href && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(n);
                }}
                className="flex-1"
              >
                <ChevronRight aria-hidden />
                <span>Open</span>
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(n);
              }}
              className="flex-1"
            >
              <X aria-hidden />
              <span>Dismiss</span>
            </Button>
          </div>
        </div>
      </SwipeableRow.Expanded>
    </SwipeableRow>
  );
}
