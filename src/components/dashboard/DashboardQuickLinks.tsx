import { useState } from "react";
import Link from "next/link";
import { BookOpen, MessageSquare } from "lucide-react";
import { FaDiscord } from "react-icons/fa";
import { cn } from "~/lib/utils";
import { IXWORLD_VERSION } from "~/components/maps/core/MapWelcomeModal";
import { BUILD_VERSION } from "~/lib/buildVersion";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { FeedbackModal } from "~/components/modals/FeedbackModal";

const EXTERNAL_LINKS = [
  {
    label: "Discord",
    href: "https://discord.gg/mgXAEYdqkd",
    icon: FaDiscord,
    color: "text-indigo-500",
  },
  {
    label: "Getting Started",
    href: "/help/getting-started",
    icon: BookOpen,
    color: "text-amber-500",
  },
] as const;

/** IxWorld version — reused from MapWelcomeModal */

export function DashboardQuickLinks() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass-hierarchy-child w-48 space-y-2.5 rounded-xl border border-border/40 p-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <svg
          className="text-muted-foreground h-3 w-3"
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
        <span className="text-muted-foreground text-[10px] font-semibold">Quick Links</span>
      </div>

      {/* Links */}
      <div className="space-y-1">
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
            <button className="group text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[10px] transition-colors hover:bg-white/5 text-left border-0 bg-transparent outline-none">
              <MessageSquare className="h-3 w-3 shrink-0 text-sky-500" />
              <span>Send Feedback</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md p-6 bg-background/95 backdrop-blur-xl border border-border/80 z-[100020]">
            <FeedbackModal onClose={() => setIsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status */}
      <div className="border-border/40 border-t pt-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-muted-foreground text-[9px]">System Online</span> 
          
        </div>
        <span className="text-muted-foreground text-[9px]">IxStates v{IXWORLD_VERSION} Build {BUILD_VERSION}</span>
      </div>
    </div>
  );
}
