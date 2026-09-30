import type { Calendar } from "iconoir-react";
import type { DrillSheetKind, V2Drill } from "~/components/mycountry/shell/DrillSheets";

export interface AgendaEvent {
  id: string;
  dayOffset: number; // 0 = Today, 1 = Tomorrow, etc.
  timeLabel: string;
  title: string;
  category: "defense" | "diplomacy" | "politics" | "economy" | "directive";
  description: string;
  directiveGoal: string;
  statusLabel: string;
  icon: typeof Calendar;
  accentCls: string;
  badgeCls: string;
  drillKind?: Exclude<V2Drill, { kind: "intent" } | null>;
  intentId?: string;
  rawIxTime?: number;
}

export interface DayHorizonItem {
  offset: number;
  dayName: string;
  dayNum: number;
  isToday: boolean;
}

export function seasonFor(month: number): { name: string; emoji: string } {
  if (month <= 1 || month === 11) return { name: "Winter", emoji: "❄️" };
  if (month <= 4) return { name: "Spring", emoji: "🌸" };
  if (month <= 7) return { name: "Summer", emoji: "☀️" };
  return { name: "Autumn", emoji: "🍂" };
}

export function getSeverityRank(s: string): number {
  const sev = String(s ?? "").toLowerCase();
  if (sev === "critical") return 4;
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  return 1;
}

export interface ExecutiveAgendaProps {
  countryId: string;
  onOpenDrill?: (drill: Exclude<DrillSheetKind, { kind: "intent" } | null>) => void;
  onIssueDirective?: (goal?: string) => void;
  onOpenIntent?: (intentId: string) => void;
}
