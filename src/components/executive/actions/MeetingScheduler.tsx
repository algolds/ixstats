"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

import { useNotify } from "~/hooks/useNotify";

import type { AgendaItem, MeetingSchedulerProps } from "./meeting-scheduler-types";
import { INTENT_TEMPLATES } from "./meeting-scheduler-intents";
import {
  officialIdsForTemplate,
  validateMeeting,
  presetScheduledTime,
  type RosterOfficial,
  type TimePreset,
} from "./meeting-scheduler-logic";
import {
  GuestCountrySelect,
  IntentSelector,
  ScheduleFields,
  SessionFields,
  type ProposedIntent,
} from "./MeetingSetupFields";
import { MeetingRosterPanel } from "./MeetingRosterPanel";
import { useScheduleMeeting } from "./useScheduleMeeting";

/** Agenda and title seeded from a proposed intent picked in "Linked intent". */
const agendaForIntent = (intent: ProposedIntent): AgendaItem[] => [
  {
    title: `Deliberate: ${intent.goal}`,
    description: `Evaluate and commit Measured, Moderate, or Extreme packages for "${intent.goal}".`,
    duration: 30,
    category: intent.category || "governance",
    tags: ["intent"],
    presenter: "Cabinet President",
    linkedIntentId: intent.id,
  },
];

export function MeetingScheduler({
  countryId,
  open,
  onOpenChange,
  defaultMeeting,
  defaultTargetCountryId,
}: MeetingSchedulerProps) {
  const notify = useNotify();
  const { user } = useUser();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("routine");
  const [timePreset, setTimePreset] = useState<TimePreset>("immediately");
  const [isChangingIntent, setIsChangingIntent] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledIxTime, setScheduledIxTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [selectedOfficials, setSelectedOfficials] = useState<string[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [meetingType, setMeetingType] = useState<"cabinet" | "bilateral">("cabinet");
  const [targetCountryId, setTargetCountryId] = useState<string>("");
  const [linkedIntentId, setLinkedIntentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: selectCountries } = api.countries.getSelectList.useQuery(
    { limit: 100 },
    { enabled: open }
  );

  const { data: intents } = api.intent.getTree.useQuery({ countryId }, { enabled: open });
  const proposedIntents: ProposedIntent[] = (
    Array.isArray(intents) ? intents : (intents?.allIntents ?? [])
  ).filter((i: ProposedIntent) => i.status === "proposed");

  const { data: officials, isLoading: officialsLoading } = api.quickActions.getOfficials.useQuery(
    { countryId, activeOnly: true },
    { enabled: open }
  );

  const { data: targetOfficials, isLoading: targetOfficialsLoading } =
    api.quickActions.getOfficials.useQuery(
      { countryId: targetCountryId, activeOnly: true },
      { enabled: open && meetingType === "bilateral" && !!targetCountryId }
    );

  const scheduleMeeting = useScheduleMeeting();

  React.useEffect(() => {
    // oxlint-disable-next-line
    if (open) setScheduledIxTime(presetScheduledTime(timePreset));
  }, [timePreset, open]);

  const handleSelectTemplate = React.useCallback(
    (tpl: (typeof INTENT_TEMPLATES)[0]) => {
      setSelectedTemplateId(tpl.id);
      setMeetingType(tpl.meetingType);
      setTitle(tpl.defaultTitle);
      setDuration(tpl.defaultDuration);
      setAgendaItems(tpl.agenda.map((item) => ({ ...item })));
      setSelectedOfficials(officialIdsForTemplate(tpl, officials ?? []));
    },
    [officials]
  );

  // Load prefills / defaults on open
  React.useEffect(() => {
    if (!open) return;
    if (!defaultMeeting) {
      const defaultTpl = INTENT_TEMPLATES.find((t) => t.id === "routine");
      if (defaultTpl) handleSelectTemplate(defaultTpl);
      setIsChangingIntent(true);
      return;
    }

    // oxlint-disable-next-line
    setTitle(defaultMeeting.title ?? "");
    setDescription(defaultMeeting.description ?? "");
    if (defaultMeeting.ixTime) {
      setScheduledIxTime(defaultMeeting.ixTime);
      setTimePreset("custom");
    }
    if (defaultMeeting.officialIds) setSelectedOfficials(defaultMeeting.officialIds);

    if (defaultTargetCountryId) {
      setTargetCountryId(defaultTargetCountryId);
      setMeetingType("bilateral");
      setSelectedTemplateId("bilateral");
    }

    const item = defaultMeeting.prefilledAgenda;
    if (item) {
      setAgendaItems([
        {
          title: item.title,
          description: item.description,
          duration: 30,
          category: item.category,
          tags: ["crisis"],
          presenter: "Cabinet President",
          linkedIssueId: item.linkedIssueId,
          linkedPolicyId: item.linkedPolicyId,
        },
      ]);
      if (item.linkedIssueId || item.linkedPolicyId) {
        setSelectedTemplateId(item.linkedIssueId ? "crisis" : "economic");
        setMeetingType("cabinet");
      }
    }
    setIsChangingIntent(false);
  }, [open, defaultMeeting, defaultTargetCountryId, handleSelectTemplate]);

  // Host and guest rosters merged into one list.
  const targetName = selectCountries?.find((c) => c.id === targetCountryId)?.name || "Foreign";
  const allOfficials: RosterOfficial[] = [
    ...(officials ?? []).map((o) => ({ ...o, countryLabel: "Internal" })),
    ...(targetOfficials ?? []).map((o) => ({ ...o, countryLabel: targetName })),
  ];
  const needsAttendees = allOfficials.length > 0 && selectedOfficials.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateMeeting({
      title,
      bilateralWithoutGuest: meetingType === "bilateral" && !targetCountryId,
      agendaCount: agendaItems.length,
      needsAttendees,
      signedIn: !!user?.id,
    });
    if (error || !user?.id) {
      notify.error(error ?? "");
      return;
    }

    setIsSubmitting(true);
    try {
      await scheduleMeeting({
        countryId,
        targetCountryId: meetingType === "bilateral" ? targetCountryId : undefined,
        user,
        title,
        description: description || undefined,
        scheduledIxTime,
        duration,
        linkedIntentId,
        agendaItems,
        selectedOfficials,
        officials: allOfficials,
      });

      const bilateral = meetingType === "bilateral";
      notify.success(
        bilateral ? "Summit requested" : "Meeting scheduled",
        bilateral
          ? "Summit request sent to the guest country."
          : `${title} has been added to your calendar.`
      );
      onOpenChange(false);

      setSelectedTemplateId("routine");
      setTimePreset("immediately");
      setTitle("");
      setDescription("");
      setAgendaItems([]);
      setSelectedOfficials([]);
      setLinkedIntentId("");
    } catch (error: any) {
      notify.error("Failed to schedule meeting", error?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTemplate = INTENT_TEMPLATES.find((t) => t.id === selectedTemplateId);
  const prefilled = defaultMeeting?.prefilledAgenda;

  const handleLinkedIntent = (val: string) => {
    setLinkedIntentId(val);
    if (val === "none") {
      setTitle("");
      setAgendaItems([]);
      return;
    }
    const selected = proposedIntents.find((i) => i.id === val);
    if (selected) {
      setTitle(`Deliberate: ${selected.goal}`);
      setAgendaItems(agendaForIntent(selected));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[450px] gap-0 overflow-visible border-none bg-transparent p-0 shadow-none md:max-w-[830px]">
        <div className="flex h-[85vh] max-h-[85vh] w-full flex-col items-start gap-3 overflow-visible md:flex-row">
          <div className="bg-surface border-separator rounded-row shadow-floating flex h-[85vh] max-h-[85vh] min-w-[320px] flex-1 flex-col overflow-hidden md:min-w-[450px]">
            <DialogHeader className="border-separator shrink-0 border-b px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">Schedule meeting</DialogTitle>
              <DialogDescription>
                Invite your cabinet or foreign delegates to discuss a crisis, a policy or a summit.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
                <IntentSelector
                  prefilled={prefilled}
                  isChanging={isChangingIntent}
                  onChangingChange={setIsChangingIntent}
                  selectedTemplateId={selectedTemplateId}
                  onSelectTemplate={handleSelectTemplate}
                />

                {meetingType === "bilateral" && (
                  <GuestCountrySelect
                    countries={selectCountries?.filter((c) => c.id !== countryId) ?? []}
                    value={targetCountryId}
                    onChange={setTargetCountryId}
                    disabled={!!defaultTargetCountryId}
                  />
                )}

                <SessionFields
                  title={title}
                  onTitleChange={setTitle}
                  description={description}
                  onDescriptionChange={setDescription}
                  intents={proposedIntents}
                  linkedIntentId={linkedIntentId}
                  onLinkedIntentChange={handleLinkedIntent}
                />

                <ScheduleFields
                  preset={timePreset}
                  onPresetChange={setTimePreset}
                  scheduledIxTime={scheduledIxTime}
                  onTimeChange={setScheduledIxTime}
                />
              </div>

              <DialogFooter className="border-separator mt-auto shrink-0 border-t px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="font-semibold"
                  disabled={isSubmitting || agendaItems.length === 0 || needsAttendees}
                >
                  {isSubmitting ? "Scheduling" : "Schedule meeting"}
                </Button>
              </DialogFooter>
            </form>
          </div>

          <MeetingRosterPanel
            officials={allOfficials}
            selectedOfficials={selectedOfficials}
            onOfficialsChange={setSelectedOfficials}
            officialsLoading={
              officialsLoading || (meetingType === "bilateral" && targetOfficialsLoading)
            }
            recommendedRoles={activeTemplate?.recommendedRoles ?? []}
            agendaItems={agendaItems}
            onAgendaChange={setAgendaItems}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
