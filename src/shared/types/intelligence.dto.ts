export interface IntelligenceOverviewDto {
  vitalityScore: number;
  activeThreats: number;
  pendingActions: number;
  unreadMessages: number;
  recentAlerts: Array<{
    id: string;
    title: string;
    severity: string;
    detectedDate: string;
  }>;
}

export interface SecurityThreatDto {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  category: "cyber" | "terrorism" | "military" | "economic" | "infrastructure" | "political";
  status: "active" | "monitoring" | "resolved" | "dismissed";
  detectedDate: string;
  source: string | null;
  assignedTeamId: string | null;
}

export interface CabinetMeetingDto {
  id: string;
  title: string;
  description: string | null;
  scheduledDate: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  attendees: string[];
  agenda: string[];
  meetingNotes: string | null;
  decisions: string[];
}

export interface IntelligenceFeedItemDto {
  id: string;
  type: "threat" | "opportunity" | "update" | "event";
  title: string;
  description: string;
  severity: string;
  timestamp: string;
  source: string;
  reliability: number;
  affectedRegions: string[];
  tags: string[];
}
