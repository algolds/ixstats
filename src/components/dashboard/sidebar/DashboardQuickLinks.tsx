"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { OpenBook as BookOpen, Bookmark, Group as Users, Compass } from "iconoir-react";
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
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

const EXTERNAL_LINKS = [
  {
    label: "Getting Started",
    href: "/help/getting-started/welcome",
    icon: BookOpen,
  },
  {
    label: "Stashes",
    href: "/stashes",
    icon: Bookmark,
  },
  {
    label: "ThinkTanks",
    href: "/thinktanks",
    icon: Users,
  },
] as const;

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
    <FacetCard className="w-48 overflow-hidden" texture="dots">
      <div className="border-separator flex items-center gap-2 border-b px-3 py-2">
        <Compass aria-hidden className="text-label-secondary size-4 shrink-0" />
        <h3 className="text-headline text-label">Quick links</h3>
      </div>
      <div className="relative space-y-2 p-3 pt-2">
        {/* Links */}
        <div className="space-y-1 pt-0.5">
          {/* Discord badge — server-rendered, passed through props */}
          {discordBadge}

          {EXTERNAL_LINKS.map((link) => {
            if (["Stashes", "Groups"].includes(link.label) && !isSignedIn) {
              return null;
            }
            const Icon = link.icon;
            const isExternal = link.href.startsWith("http");
            const Comp = isExternal ? "a" : Link;
            const extraProps = isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};

            return (
              <Comp
                key={link.label}
                href={link.href}
                {...extraProps}
                className="text-label-secondary hover:text-label hover:bg-fill-4 active:bg-fill-3 rounded-row text-footnote duration-fast ease-out-facet focus-visible:outline-tint flex items-center justify-between gap-2 px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </div>

                {link.label === "ThinkTanks" && thinktankUnreadCount > 0 && (
                  <Badge variant="tinted" className="tabular-nums">
                    {thinktankUnreadCount > 99 ? "99+" : thinktankUnreadCount}
                    <span className="sr-only"> unread</span>
                  </Badge>
                )}
              </Comp>
            );
          })}
        </div>

        <div className="border-separator space-y-2 border-t pt-2">
          <Link
            href="/changelog"
            className="group rounded-control focus-visible:outline-tint block focus-visible:outline-2 focus-visible:outline-offset-2"
            title="View Release Notes & Changelog"
          >
            <StatusIndicator
              status={getChannelStatus(CHANNEL)}
              label={`v${PLATFORM_VERSION} ${channelTheme.shortName} · Build ${BUILD_VERSION}`}
              size="sm"
              className={cn(
                "text-caption group-hover:border-separator w-full justify-center tabular-nums transition-colors",
                channelTheme.borderColor,
                channelTheme.bgColor
              )}
            />
          </Link>

          <div className="space-y-1 text-center">
            <div className="text-label-secondary text-footnote flex items-center justify-center gap-2">
              <Link href="/privacy" className="hover:text-label transition-colors hover:underline">
                Privacy Policy
              </Link>
              <span className="opacity-40">·</span>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="hover:text-label cursor-pointer transition-colors hover:underline"
                  >
                    Feedback
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-6">
                  <FeedbackModal onClose={() => setIsOpen(false)} />
                </DialogContent>
              </Dialog>
              <span className="opacity-40">·</span>
              <Link href="/terms" className="hover:text-label transition-colors hover:underline">
                Terms
              </Link>
            </div>
            <p className="text-label-tertiary text-footnote">
              &copy; {new Date().getFullYear()} IxStates
            </p>
          </div>
        </div>
      </div>
    </FacetCard>
  );
}
