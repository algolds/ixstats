"use client";

import React from "react";
import Link from "next/link";
import {
  Clock,
  OpenBook as BookOpen,
  ChatBubble as MessageSquare,
  Flash,
  Globe,
  Spark as Sparkles,
  Crown,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import type { HistoryItem } from "../types";
import { Card } from "~/components/ui/card";

interface PassportHistoryTabProps {
  history: HistoryItem[];
  cleanUsername: string;
}

export const PassportHistoryTab = React.memo(function PassportHistoryTab({
  history,
  cleanUsername,
}: PassportHistoryTabProps) {
  if (!history || history.length === 0) {
    return (
      <Card variant="inset" padding="none" className="border-separator border">
        <EmptyState
          icon={<Clock />}
          title="No activity yet"
          message={`@${cleanUsername} has no recorded activity yet.`}
        />
      </Card>
    );
  }

  const getSystemBadge = (system: string) => {
    switch (system) {
      case "wikios":
        return { label: "WikiOS", icon: BookOpen };
      case "forum":
        return { label: "Forum", icon: MessageSquare };
      case "mycountry":
        return { label: "MyCountry", icon: Flash };
      case "realm":
        return { label: "Realm", icon: Globe };
      case "thinkpages":
        return { label: "ThinkPages", icon: Sparkles };
      case "vault":
        return { label: "Vault", icon: Crown };
      default:
        return { label: "System", icon: Clock };
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-subhead text-label-secondary">
        Activity history <span className="tabular-nums">({history.length})</span>
      </h2>

      <ol className="border-separator relative ml-4 space-y-4 border-l pl-6">
        {history.map((event) => {
          const badge = getSystemBadge(event.system);
          const Icon = badge.icon;
          const formattedDate = new Date(event.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          return (
            <li key={event.id} className="relative">
              {/* Timeline dot */}
              <span
                aria-hidden
                className="bg-fill ring-surface absolute top-4 -left-[31px] size-3 rounded-full ring-4"
              />

              <Card variant="inset" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">
                      <Icon aria-hidden />
                      {badge.label}
                    </Badge>
                    <span className="text-label-secondary text-footnote tabular-nums">
                      {formattedDate}
                    </span>
                  </div>

                  {event.objectUrl && (
                    <Link
                      href={event.objectUrl}
                      className="text-tint text-footnote inline-flex cursor-pointer items-center gap-1 font-medium hover:underline"
                    >
                      <span>View</span>
                      <ExternalLink aria-hidden className="size-3.5" />
                    </Link>
                  )}
                </div>

                <h4 className="text-label text-headline">{event.title}</h4>

                {event.description && (
                  <p className="text-label-secondary text-footnote">{event.description}</p>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
});
