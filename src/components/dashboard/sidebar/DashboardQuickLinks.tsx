"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { OpenBook as BookOpen, Bookmark, Group as Users } from "iconoir-react";
import { cn } from "~/lib/utils";
import { StatusIndicator } from "~/components/ui/status-indicator";
import {
  BUILD_VERSION,
  PLATFORM_VERSION,
  CHANNEL,
  getChannelStatus,
  CHANNEL_CONFIG,
} from "~/lib/buildVersion";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { FeedbackModal } from "~/components/dashboard/sidebar/FeedbackModal";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

const QUICK_LINKS = [
  { label: "Getting started", href: "/help/getting-started/welcome", icon: BookOpen },
  { label: "Stashes", href: "/stashes", icon: Bookmark, signedInOnly: true },
  { label: "ThinkTanks", href: "/thinktanks", icon: Users },
] as const;

/** The legal footer's text links: underline on hover and keyboard focus, with the focus ring. */
const FOOTER_LINK =
  "hover:text-label focus-visible:text-label rounded-control-sm focus-visible:outline-tint transition-colors hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2";

interface DashboardQuickLinksProps {
  /** Server-rendered Discord badge passed from a server component boundary. */
  discordBadge?: ReactNode;
}

export function DashboardQuickLinks({ discordBadge }: DashboardQuickLinksProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn } = useUser();
  const channelTheme = CHANNEL_CONFIG[CHANNEL];

  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(
    {},
    {
      enabled: !!isSignedIn,
      staleTime: 30000,
    }
  );

  const { data: notificationsData } = api.notifications.getUserNotifications.useQuery(
    { limit: 20 },
    { enabled: !!isSignedIn, staleTime: 30000 }
  );

  const thinktankUnreadCount =
    (folderCounts?.thinktank ?? 0) +
    (notificationsData?.notifications?.filter(
      (n: any) => (n.source === "thinktank" || n.category === "social") && !n.isRead
    )?.length ?? 0);

  return (
    <Card className="w-48">
      <h2 className="text-headline text-label px-3 pt-3">Quick links</h2>
      <div className="space-y-2 p-3 pt-2">
        <div className="space-y-1 pt-0.5">
          {discordBadge}

          {QUICK_LINKS.filter((link) => isSignedIn || !("signedInOnly" in link)).map(
            ({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="text-label-secondary hover:text-label focus-visible:text-label hover:bg-fill-4 active:bg-fill-3 rounded-row text-footnote focus-visible:outline-tint flex items-center justify-between gap-2 px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </div>

                {label === "ThinkTanks" && thinktankUnreadCount > 0 && (
                  <Badge variant="success">
                    {thinktankUnreadCount > 99 ? "99+" : thinktankUnreadCount}
                    <span className="sr-only"> unread</span>
                  </Badge>
                )}
              </Link>
            )
          )}
        </div>

        <div className="border-separator space-y-2 border-t pt-2">
          <Link
            href="/changelog"
            className="group rounded-control focus-visible:outline-tint block focus-visible:outline-2 focus-visible:outline-offset-2"
            title="View changelog"
          >
            <StatusIndicator
              status={getChannelStatus(CHANNEL)}
              label={`v${PLATFORM_VERSION} ${channelTheme.shortName} · Build ${BUILD_VERSION}`}
              size="sm"
              className={cn(
                "text-caption group-hover:border-separator group-focus-visible:border-separator w-full justify-center tabular-nums transition-colors",
                channelTheme.borderColor,
                channelTheme.bgColor
              )}
            />
          </Link>

          <div className="space-y-1 text-center">
            <div className="text-label-secondary text-footnote flex items-center justify-center gap-2">
              <Link href="/privacy" className={FOOTER_LINK}>
                Privacy policy
              </Link>
              <span aria-hidden className="opacity-40">
                ·
              </span>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <button type="button" className={cn(FOOTER_LINK, "cursor-pointer")}>
                    Feedback
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-6">
                  <FeedbackModal onClose={() => setIsOpen(false)} />
                </DialogContent>
              </Dialog>
              <span aria-hidden className="opacity-40">
                ·
              </span>
              <Link href="/terms" className={FOOTER_LINK}>
                Terms
              </Link>
            </div>
            <p className="text-label-tertiary text-footnote">
              &copy; {new Date().getFullYear()} IxStates
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
