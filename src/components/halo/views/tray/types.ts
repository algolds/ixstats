import type React from "react";
import { timeAgo } from "~/lib/format/compact";
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
  critical: { bg: "bg-destructive/15", text: "text-destructive" },
  high: { bg: "bg-warning/15", text: "text-warning" },
  medium: { bg: "bg-caution/15", text: "text-caution" },
  warning: { bg: "bg-caution/15", text: "text-caution" },
  success: { bg: "bg-success/15", text: "text-success" },
  error: { bg: "bg-destructive/15", text: "text-destructive" },
  info: { bg: "bg-caution/15", text: "text-caution" },
};

export function getColors(n: NotificationItem) {
  const level = n.priority ?? n.severity ?? n.type;
  return (level ? PRIORITY_COLORS[level] : undefined) ?? PRIORITY_COLORS.info!;
}

export const relativeTime = (ts: string | number | Date): string => timeAgo(ts);
