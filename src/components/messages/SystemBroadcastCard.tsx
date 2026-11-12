"use client";

import Link from "next/link";
import {
  AntennaSignal as Radio,
  Crown,
  OpenNewWindow as ExternalLink,
  Xmark as X,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatTimestamp } from "~/lib/messages/format";
import { toRouterPath } from "~/lib/base-path";
import { sanitizeMessageContent } from "~/lib/utils/sanitize-html";

export interface BroadcastItem {
  id: string;
  title?: string | null;
  subject?: string | null;
  description?: string | null;
  message?: string | null;
  content?: string | null;
  type?: string | null;
  category?: string | null;
  priority?: string | null;
  href?: string | null;
  createdAt?: Date | string | null;
  ixTimeTimestamp?: Date | string | null;
}

const DISPATCH_PATTERN = /diplomatic|treaty|embassy|alliance|summons|dispatch/;

function getSystemAlertStyle(content: string, type?: string | null) {
  if (DISPATCH_PATTERN.test(`${content} ${type ?? ""}`.toLowerCase())) {
    return {
      icon: Crown,
      iconColor: "text-yellow-ink bg-yellow/15",
      badgeClass: "text-yellow-ink bg-yellow/15",
      label: "Dispatch",
    };
  }
  return {
    icon: Radio,
    iconColor: "text-indigo-ink bg-indigo/15",
    badgeClass: "text-indigo-ink bg-indigo/15",
    label: "System",
  };
}

export function SystemBroadcastCard({
  item,
  onDismiss,
}: {
  item: BroadcastItem;
  onDismiss?: () => void;
}) {
  const content = item.description ?? item.message ?? item.content ?? "";
  const title = item.title ?? item.subject ?? "System notification";
  const {
    icon: Icon,
    iconColor,
    badgeClass,
    label,
  } = getSystemAlertStyle(`${title} ${content}`, item.type ?? item.category);
  const at = item.createdAt ?? item.ixTimeTimestamp;

  return (
    <div className="bg-surface-secondary rounded-row relative mx-4 my-2 flex gap-3 p-4">
      <div
        className={cn(
          "rounded-control flex size-9 shrink-0 items-center justify-center self-start",
          iconColor
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("text-caption rounded-full px-2 py-0.5", badgeClass)}>{label}</span>
            {item.priority && (
              <span className="text-footnote text-label-secondary">· {item.priority}</span>
            )}
          </div>
          {at && (
            <span className="text-footnote text-label-secondary tabular-nums">
              {formatTimestamp(at)}
            </span>
          )}
        </div>

        <h4 className="text-headline text-label mb-1">{title}</h4>

        <div
          className="text-callout text-label-secondary [&>a]:text-tint [&>a]:underline [&>p]:mb-0"
          dangerouslySetInnerHTML={{ __html: sanitizeMessageContent(content) }}
        />

        {item.href && (
          <div className="mt-2 flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={toRouterPath(item.href)}>
                <span>Open details</span>
                <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          className="text-label-secondary hover:text-label absolute top-2 right-2"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
