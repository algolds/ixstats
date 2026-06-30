export interface AgendaItem {
  title: string;
  description: string;
  duration: number;
  category: string;
  tags: string[];
  presenter: string;
  linkedIssueId?: string;
  linkedPolicyId?: string;
}

export interface MeetingSchedulerProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeeting?: {
    title?: string;
    description?: string;
    ixTime?: number;
    officialIds?: string[];
    prefilledAgenda?: {
      title: string;
      description: string;
      category: string;
      linkedIssueId?: string;
      linkedPolicyId?: string;
    };
  };
  defaultTargetCountryId?: string;
}

export interface IntentTemplate {
  id: string;
  name: string;
  description: string;
  meetingType: "cabinet" | "bilateral";
  defaultTitle: string;
  defaultDuration: number;
  recommendedRoles: string[];
  agenda: {
    title: string;
    description: string;
    duration: number;
    category: string;
    tags: string[];
    presenter: string;
  }[];
}
