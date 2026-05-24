"use client";

import { useState } from "react";
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  Handshake,
  Shield,
  Rss,
  Landmark,
  Trophy,
  BookOpen,
  MessageCircle,
  ExternalLink,
  Clock,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { formatTimeAgo } from "~/lib/time-utils";
import { cn } from "~/lib/utils";

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof TrendingUp; bg: string; text: string; label: string; border: string }
> = {
  economic: {
    icon: TrendingUp,
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    label: "Economy",
    border: "text-emerald-600 border-emerald-500/30",
  },
  crisis: {
    icon: AlertTriangle,
    bg: "bg-red-500/10",
    text: "text-red-500",
    label: "Crisis",
    border: "text-red-600 border-red-500/30",
  },
  diplomatic: {
    icon: Handshake,
    bg: "bg-cyan-500/10",
    text: "text-cyan-500",
    label: "Diplomacy",
    border: "text-cyan-600 border-cyan-500/30",
  },
  military: {
    icon: Shield,
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    label: "Security",
    border: "text-orange-600 border-orange-500/30",
  },
  social: {
    icon: Rss,
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    label: "Social",
    border: "text-blue-600 border-blue-500/30",
  },
  political: {
    icon: Landmark,
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    label: "Political",
    border: "text-purple-600 border-purple-500/30",
  },
  achievement: {
    icon: Trophy,
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    label: "Achievement",
    border: "text-amber-600 border-amber-500/30",
  },
  wiki: {
    icon: BookOpen,
    bg: "bg-teal-500/10",
    text: "text-teal-500",
    label: "Wiki",
    border: "text-teal-600 border-teal-500/30",
  },
  forum: {
    icon: MessageCircle,
    bg: "bg-indigo-500/10",
    text: "text-indigo-500",
    label: "Forum",
    border: "text-indigo-600 border-indigo-500/30",
  },
};

type CategoryFilter = "all" | keyof typeof CATEGORY_CONFIG;

const FILTER_OPTIONS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "economic", label: "Economy" },
  { id: "crisis", label: "Crisis" },
  { id: "diplomatic", label: "Diplomacy" },
  { id: "military", label: "Security" },
  { id: "social", label: "Social" },
  { id: "political", label: "Political" },
  { id: "wiki", label: "Wiki" },
  { id: "forum", label: "Forum" },
];

interface Headline {
  id: string;
  text: string;
  category: string;
  priority: string;
  timestamp: string;
  url?: string;
}

interface WorldEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  headlines: Headline[];
}

export function WorldEventsModal({ isOpen, onClose, headlines }: WorldEventsModalProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const filtered = filter === "all" ? headlines : headlines.filter((h) => h.category === filter);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-yellow-500" />
            World Events
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {headlines.length} headlines
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                filter === opt.id
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Headlines list */}
        <div className="max-h-[450px] space-y-1.5 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-xs">
              No events in this category
            </p>
          ) : (
            filtered.map((item) => {
              const config = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.economic!;
              const Icon = config.icon;
              const isCritical = item.priority === "critical";
              const isHigh = item.priority === "high";
              const Wrapper = item.url ? "a" : "div";
              const wrapperProps = item.url
                ? { href: item.url, target: "_blank" as const, rel: "noopener noreferrer" }
                : {};
              return (
                <Wrapper
                  key={item.id}
                  {...wrapperProps}
                  className={cn(
                    "hover:bg-muted/30 flex items-start gap-3 rounded-lg border p-2.5 transition-colors",
                    isCritical ? "border-red-500/30 bg-red-500/5" : "border-border/40",
                    item.url && "cursor-pointer"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      config.bg,
                      config.text
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isCritical && (
                        <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[8px]">
                          BREAKING
                        </Badge>
                      )}
                      {isHigh && !isCritical && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-500/30 px-1 py-0 text-[8px] text-amber-600"
                        >
                          ALERT
                        </Badge>
                      )}
                      <span
                        className={cn(
                          "text-xs leading-snug font-medium",
                          isCritical && "text-red-400"
                        )}
                      >
                        {item.text}
                      </span>
                      {item.url && (
                        <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" />
                      )}
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                      <Badge
                        variant="outline"
                        className={cn("px-1 py-0 text-[8px]", config.border)}
                      >
                        {config.label}
                      </Badge>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTimeAgo(new Date(item.timestamp))}
                      </span>
                    </div>
                  </div>
                </Wrapper>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
