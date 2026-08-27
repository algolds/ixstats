import type React from "react";
import {
  Bell,
  OpenBook as BookOpen,
  CheckCircle,
  InfoCircle as Info,
  WarningTriangle as AlertTriangle,
  WarningCircle as AlertCircle,
  StatUp as TrendingUp,
  Globe,
  Group as Users,
  City as Building2,
} from "iconoir-react";

export type NotificationTab = "alerts" | "messages";

export interface NotificationItem {
  id: string;
  title: string;
  message?: string | null;
  description?: string | null;
  category?: string | null;
  type?: string | null;
  priority?: string | null;
  severity?: string | null;
  status?: string | null;
  timestamp?: number | string | Date | null;
  createdAt?: number | string | Date | null;
  actionUrl?: string | null;
  href?: string | null;
  metadata?: Record<string, unknown> | string | null;
  read?: boolean | null;
  dismissed?: boolean | null;
  source?: string | null;
  deliveryMethod?: string | null;
}

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  economic: TrendingUp,
  diplomatic: Globe,
  social: Users,
  security: AlertTriangle,
  governance: Building2,
  achievement: CheckCircle,
  crisis: AlertCircle,
  opportunity: TrendingUp,
  military: AlertTriangle,
  wiki: BookOpen,
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertCircle,
};

export function getIcon(n: NotificationItem) {
  return (
    (n.category ? ICON_MAP[n.category] : undefined) ??
    (n.type ? ICON_MAP[n.type] : undefined) ??
    Bell
  );
}

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-red-500/15", text: "text-red-400" },
  high: { bg: "bg-rose-500/15", text: "text-rose-400" },
  medium: { bg: "bg-amber-500/15", text: "text-amber-400" },
  warning: { bg: "bg-amber-500/15", text: "text-amber-400" },
  success: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  error: { bg: "bg-red-500/15", text: "text-red-400" },
  info: { bg: "bg-amber-500/15", text: "text-amber-400" },
};

export function getColors(n: NotificationItem) {
  const level = n.priority ?? n.severity ?? n.type;
  return (level ? PRIORITY_COLORS[level] : undefined) ?? PRIORITY_COLORS.info!;
}

export function relativeTime(ts: string | number | Date): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
