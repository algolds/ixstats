import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, MessageSquare, Bookmark } from "lucide-react";
import { cn } from "~/lib/utils";
import { StatusIndicator } from "~/components/status-indicator";
import { BUILD_VERSION, IXWORLD_VERSION } from "~/lib/buildVersion";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { FeedbackModal } from "~/components/modals/FeedbackModal";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

const EXTERNAL_LINKS = [
  {
    label: "Getting Started",
    href: "/help/getting-started",
    icon: BookOpen,
    color: "text-amber-600 dark:text-amber-500",
  },
  {
    label: "Stashes",
    href: "/stashes",
    icon: Bookmark,
    color: "text-blue-500",
  },
] as const;

interface DashboardQuickLinksProps {
  /** Server-rendered Discord badge passed from a server component boundary. */
  discordBadge?: ReactNode;
}

export function DashboardQuickLinks({ discordBadge }: DashboardQuickLinksProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "w-48 overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      {/* Cutout tab header */}
      <div className="relative bg-cyan-500/10 px-3 pt-2.5 pb-4">
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold">
          <svg
            className="h-3.5 w-3.5 text-cyan-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          Quick Links
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>
      <CutoutCardContent className="space-y-2.5 p-3 pt-1">
        {/* Links */}
        <div className="space-y-1">
          {/* Discord badge — server-rendered, passed through props */}
          {discordBadge}

          {EXTERNAL_LINKS.map((link) => {
            const Icon = link.icon;
            const isExternal = link.href.startsWith("http");
            const Comp = isExternal ? "a" : Link;
            const extraProps = isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};

            return (
              <Comp
                key={link.label}
                href={link.href}
                {...extraProps}
                className="group text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-1.5 py-1 text-[10px] transition-colors hover:bg-white/5"
              >
                <Icon className={cn("h-3 w-3 shrink-0", link.color)} />
                <span>{link.label}</span>
              </Comp>
            );
          })}

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <button className="group text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1 text-left text-[10px] transition-colors outline-none hover:bg-white/5">
                <MessageSquare className="h-3 w-3 shrink-0 text-sky-500" />
                <span>Send Feedback</span>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-background/95 border-border/80 z-[100020] max-w-md border p-6 backdrop-blur-xl">
              <FeedbackModal onClose={() => setIsOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="border-border/40 space-y-1.5 border-t pt-2">
          <StatusIndicator status="operational" label="System Online" size="sm" />
          <div className="text-muted-foreground/60 text-[9px] tabular-nums">
            v{IXWORLD_VERSION} · Build {BUILD_VERSION}
          </div>
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
