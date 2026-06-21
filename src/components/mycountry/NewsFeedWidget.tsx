"use client";

import { useMemo } from "react";
import {
  Newspaper,
  Globe,
  Landmark,
  Swords,
  Heart,
  AlertTriangle,
  Zap,
  Gavel,
  type LucideIcon,
} from "lucide-react";
import { api } from "~/trpc/react";
import { CutoutPanel } from "~/components/mycountry/cards";
import { ACCENT_CLASSES } from "~/components/mycountry/cards/accents";
import type { ContextActivityEntry } from "~/components/mycountry/primitives";

interface NewsFeedWidgetProps {
  countryId: string;
}

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  diplomatic: { icon: Globe, color: "text-cyan-500" },
  economic: { icon: Landmark, color: "text-emerald-500" },
  military: { icon: Swords, color: "text-red-500" },
  social: { icon: Heart, color: "text-pink-500" },
  emergency: { icon: AlertTriangle, color: "text-amber-500" },
  governance: { icon: Gavel, color: "text-indigo-500" },
};

export function NewsFeedWidget({ countryId }: NewsFeedWidgetProps) {
  const { data: canonItems, isLoading } = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 12 },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const activity = useMemo<ContextActivityEntry[]>(() => {
    if (!canonItems || canonItems.length === 0) return [];
    return canonItems.slice(0, 8).map((item) => {
      const { icon, color } = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS["diplomatic"];
      return {
        id: item.id,
        icon,
        iconColor: color,
        text: item.title.length > 120 ? item.title.slice(0, 117) + "..." : item.title,
        time: new Date(item.timestamp),
      };
    });
  }, [canonItems]);

  const amber = ACCENT_CLASSES["amber"];

  if (isLoading) return null;

  return (
    <CutoutPanel className="mt-3" contentClassName="p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className={amber.text + " h-3.5 w-3.5"} />
          <span className="text-xs font-semibold">News Feed</span>
        </div>
        {activity.length > 0 && (
          <span className="text-muted-foreground text-[10px]">{activity.length} items</span>
        )}
      </div>

      <div className="space-y-1.5">
        {activity.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-3">
            <Zap className="text-muted-foreground/40 h-4 w-4" />
            <p className="text-muted-foreground text-center text-[11px]">
              No recent activity. Execute actions to generate news.
            </p>
          </div>
        )}
        {activity.map((e) => (
          <div key={e.id} className="flex items-start gap-2 py-1">
            <e.icon className={e.iconColor + " mt-0.5 h-3 w-3 shrink-0"} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[11px] leading-snug">{e.text}</p>
              <span className="text-muted-foreground text-[10px]">{timeAgo(e.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </CutoutPanel>
  );
}

function timeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
