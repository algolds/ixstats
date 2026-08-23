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
import { FeedbackModal } from "~/components/ui/modals/FeedbackModal";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

const EXTERNAL_LINKS = [
  {
    label: "Getting Started",
    href: "/help/getting-started/welcome",
    icon: BookOpen,
    color: "text-amber-600 dark:text-amber-500",
  },
  {
    label: "Stashes",
    href: "/stashes",
    icon: Bookmark,
    color: "text-blue-500",
  },
  {
    label: "ThinkTanks",
    href: "/thinktanks",
    icon: Users,
    color: "text-emerald-500",
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
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "w-48 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-xl backdrop-blur-xl transition-all duration-200"
      )}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.05}
    >
      {/* Sleek Apple-style header bar */}
      <div className="relative flex items-center justify-between border-b border-cyan-500/15 bg-gradient-to-r from-cyan-500/15 via-cyan-500/10 to-cyan-500/5 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/20 shadow-sm shadow-cyan-500/10 backdrop-blur-sm">
            <Compass className="h-3 w-3 text-cyan-400" />
          </div>
          <span className="text-xs font-semibold tracking-tight text-cyan-900 dark:text-cyan-300">
            Quick Links
          </span>
        </div>
     
      </div>
      <CutoutCardContent className="space-y-2.5 p-3 pt-2.5">
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
                className="group text-muted-foreground hover:text-foreground flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-[11px] font-normal tracking-normal transition-all duration-150 hover:bg-white/[0.06] active:scale-[0.97]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform duration-150 group-hover:scale-110",
                      link.color
                    )}
                  />
                  <span className="truncate">{link.label}</span>
                </div>

                {link.label === "ThinkTanks" && thinktankUnreadCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 text-[9px] font-bold tracking-tight text-emerald-400 ring-1 ring-emerald-500/30 backdrop-blur-xs shadow-2xs transition-transform group-hover:scale-105">
                    {thinktankUnreadCount > 99 ? "99+" : thinktankUnreadCount}
                  </span>
                )}
              </Comp>
            );
          })}
        </div>

        <div className="border-border/30 space-y-2 border-t pt-2">
          <Link
            href="/changelog"
            className="group block transition-all duration-150 active:scale-[0.98]"
            title="View Release Notes & Changelog"
          >
            <StatusIndicator
              status={getChannelStatus(CHANNEL)}
              label={`v${PLATFORM_VERSION} ${channelTheme.shortName} · Build ${BUILD_VERSION}`}
              size="sm"
              className={cn(
                "w-full justify-center text-[10px] font-medium tracking-tight tabular-nums transition-all group-hover:border-white/30 group-hover:shadow-xs",
                channelTheme.borderColor,
                channelTheme.bgColor
              )}
            />
          </Link>

          <div className="space-y-1 text-center">
            <div className="text-muted-foreground/70 flex items-center justify-center gap-1.5 text-[9.5px]">
              <Link
                href="/privacy"
                className="hover:text-foreground transition-colors hover:underline"
              >
                Privacy Policy
              </Link>
              <span className="opacity-40">·</span>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <button className="hover:text-foreground cursor-pointer transition-colors hover:underline">
                    Feedback
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-background/95 border-border/80 z-[100020] max-w-md border p-6 backdrop-blur-xl">
                  <FeedbackModal onClose={() => setIsOpen(false)} />
                </DialogContent>
              </Dialog>
              <span className="opacity-40">·</span>
              <Link
                href="/terms"
                className="hover:text-foreground transition-colors hover:underline"
              >
                Terms
              </Link>
            </div>
            <p className="text-muted-foreground/50 text-[8.5px] tracking-tight">
              &copy; {new Date().getFullYear()} IxStates 
            </p>
          </div>
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
