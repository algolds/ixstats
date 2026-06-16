"use client";

import { useMemo } from "react";
import {
  Globe,
  Landmark,
  Heart,
  AlertTriangle,
  Gavel,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { api } from "~/trpc/react";
import { CutoutPanel } from "~/components/mycountry/cards";
import { ACCENT_CLASSES } from "~/components/mycountry/cards/accents";

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  diplomatic: { icon: Globe, color: "text-cyan-500" },
  economic: { icon: Landmark, color: "text-emerald-500" },
  social: { icon: Heart, color: "text-pink-500" },
  emergency: { icon: AlertTriangle, color: "text-amber-500" },
  governance: { icon: Gavel, color: "text-indigo-500" },
};

function timeAgo(date: Date): string {
  const m = Math.floor((Date.now() - date.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NarrativeFeed({ countryId }: { countryId: string }) {
  const { data, isLoading } = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 30 },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const amber = ACCENT_CLASSES["amber"];
  const items = useMemo(() => data ?? [], [data]);

  if (isLoading) return null;

  return (
    <CutoutPanel className="mt-4" contentClassName="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Newspaper className={amber.text + " h-4 w-4"} />
        <span className="text-sm font-semibold">National Story</span>
        {items.length > 0 && (
          <span className="text-muted-foreground text-[11px]">{items.length} entries</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          Nothing has happened yet. Enact a policy, conclude a meeting, or shape your diplomacy —
          it will be recorded here.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const { icon: Icon, color } = CATEGORY_ICONS[it.category] ?? CATEGORY_ICONS.diplomatic;
            return (
              <div key={it.id} className="flex items-start gap-2.5 py-1">
                <Icon className={color + " mt-0.5 h-3.5 w-3.5 shrink-0"} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs leading-snug">{it.title}</p>
                  <span className="text-muted-foreground text-[10px]">
                    {timeAgo(new Date(it.timestamp))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CutoutPanel>
  );
}
