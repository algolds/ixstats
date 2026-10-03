import { api } from "~/trpc/react";
import type { AgendaItem } from "./meeting-scheduler-types";
import type { RosterOfficial } from "./meeting-scheduler-logic";

interface ScheduleMeetingInput {
  countryId: string;
  targetCountryId?: string;
  user: { id: string; fullName?: string | null; username?: string | null };
  title: string;
  description?: string;
  scheduledIxTime: number;
  duration: number;
  /** The "Linked intent" select value; "none" or empty means unlinked. */
  linkedIntentId: string;
  agendaItems: AgendaItem[];
  selectedOfficials: string[];
  officials: RosterOfficial[];
}

/** Creates the meeting, then its agenda items and invitations (the Ruler alone when nobody is picked). */
export function useScheduleMeeting() {
  const createMeeting = api.meetings.createMeeting.useMutation();
  const addAgendaItem = api.meetings.addAgendaItem.useMutation();
  const recordAttendance = api.meetings.recordAttendance.useMutation();

  return async (input: ScheduleMeetingInput) => {
    const { user, selectedOfficials, officials } = input;
    const meeting = await createMeeting.mutateAsync({
      countryId: input.countryId,
      targetCountryId: input.targetCountryId,
      userId: user.id,
      title: input.title,
      description: input.description,
      scheduledDate: new Date(input.scheduledIxTime),
      duration: input.duration,
      scheduledIxTime: input.scheduledIxTime,
      intentId:
        input.linkedIntentId && input.linkedIntentId !== "none" ? input.linkedIntentId : undefined,
    });

    const attendance =
      selectedOfficials.length > 0
        ? selectedOfficials.map((officialId) => {
            const official = officials.find((o) => o.id === officialId);
            return recordAttendance.mutateAsync({
              meetingId: meeting.id,
              officialId,
              attendeeName: official?.name ?? "Official",
              attendanceStatus: "invited",
              attendeeRole: official ? `${official.title} (${official.countryLabel})` : undefined,
            });
          })
        : [
            recordAttendance.mutateAsync({
              meetingId: meeting.id,
              officialId: null,
              attendeeName: user.fullName || user.username || "Ruler",
              attendanceStatus: "invited",
              attendeeRole: "Head of State",
            }),
          ];

    await Promise.all([
      ...input.agendaItems.map((item, index) =>
        addAgendaItem.mutateAsync({
          meetingId: meeting.id,
          title: item.title,
          description: item.description || undefined,
          order: index,
          estimatedDuration: item.duration,
          priority: "medium",
          linkedIssueId: item.linkedIssueId,
          linkedPolicyId: item.linkedPolicyId,
          linkedIntentId: item.linkedIntentId,
        })
      ),
      ...attendance,
    ]);
  };
}
