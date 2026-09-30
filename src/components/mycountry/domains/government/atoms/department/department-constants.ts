import React from "react";
import {
  Shield,
  GraduationCap,
  Heart,
  Suitcase as Briefcase,
  DeliveryTruck as Truck,
  Leaf,
  Group as Users,
  Building,
  Globe,
  Flash as Zap,
  Wifi,
  Palette,
  Flask as Beaker,
  HomeSimple as Home,
  Medal,
  Eye,
  WarningTriangle as AlertTriangle,
  MoreHoriz as MoreHorizontal,
} from "iconoir-react";
import * as IconoirIcons from "iconoir-react";
import type { DepartmentCategory, OrganizationalLevel } from "~/types/government";

export function isImageIconSource(value: string | undefined): value is string {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("data:image/")
  );
}

export function resolveNamedDepartmentIcon(
  iconName: string | undefined
): React.ComponentType<{ className?: string }> | null {
  if (!iconName || isImageIconSource(iconName)) return null;
  const icon = (IconoirIcons as Record<string, unknown>)[iconName];
  return typeof icon === "function" ? (icon as React.ComponentType<{ className?: string }>) : null;
}

export const departmentCategories: DepartmentCategory[] = [
  "Defense",
  "Education",
  "Health",
  "Finance",
  "Foreign Affairs",
  "Interior",
  "Justice",
  "Transportation",
  "Agriculture",
  "Environment",
  "Labor",
  "Commerce",
  "Energy",
  "Communications",
  "Culture",
  "Science and Technology",
  "Social Services",
  "Housing",
  "Veterans Affairs",
  "Intelligence",
  "Emergency Management",
  "Other",
];

export const organizationalLevels: OrganizationalLevel[] = [
  "Ministry",
  "Department",
  "Agency",
  "Bureau",
  "Office",
  "Commission",
];

export const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Defense: Shield,
  Education: GraduationCap,
  Health: Heart,
  Finance: Briefcase,
  "Foreign Affairs": Globe,
  Interior: Home,
  Justice: Users,
  Transportation: Truck,
  Agriculture: Leaf,
  Environment: Leaf,
  Labor: Users,
  Commerce: Building,
  Energy: Zap,
  Communications: Wifi,
  Culture: Palette,
  "Science and Technology": Beaker,
  "Social Services": Heart,
  Housing: Home,
  "Veterans Affairs": Medal,
  Intelligence: Eye,
  "Emergency Management": AlertTriangle,
  Other: MoreHorizontal,
};

export const categoryColors: Record<string, string> = {
  Defense: "#dc2626",
  Education: "#2563eb",
  Health: "#059669",
  Finance: "#7c3aed",
  "Foreign Affairs": "#0891b2",
  Interior: "#ea580c",
  Justice: "#4338ca",
  Transportation: "#0d9488",
  Agriculture: "#65a30d",
  Environment: "#059669",
  Labor: "#7c2d12",
  Commerce: "#1d4ed8",
  Energy: "#eab308",
  Communications: "#6366f1",
  Culture: "#ec4899",
  "Science and Technology": "#8b5cf6",
  "Social Services": "#ef4444",
  Housing: "#f59e0b",
  "Veterans Affairs": "#10b981",
  Intelligence: "#374151",
  "Emergency Management": "#dc2626",
  Other: "#6b7280",
};

export const getPriorityDetails = (level: number) => {
  if (level <= 3) {
    return {
      label: "Low (Reactive)",
      desc: "Vulnerability to crises increased by +15%. Emergent sector issues resolve slowly.",
      color: "text-red-400 bg-red-500/10 border-red-500/20",
    };
  }
  if (level <= 6) {
    return {
      label: "Standard (Active)",
      desc: "Balanced operational stance. Baseline event occurrence. Regular response times.",
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    };
  }
  if (level <= 8) {
    return {
      label: "High (Strategic)",
      desc: "Vulnerability to crises reduced by -20%. Fast resolution of events.",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    };
  }
  return {
    label: "Critical (Executive)",
    desc: "Vulnerability to crises reduced by -50%. Instant crisis resolution.",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };
};
