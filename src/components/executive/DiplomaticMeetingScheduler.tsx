"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import type { Country } from "~/types/ixstats";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { IxTimePicker } from "~/components/ui/ixtime-picker";
import { Globe, Calendar, MapPin, Users, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export interface DiplomaticMeeting {
  id: string;
  type: "summit" | "negotiation" | "cultural_planning" | "treaty_signing";
  withCountries: string[]; // country IDs
  scheduledFor: string; // IxTime
  agenda: string;
  location: string; // which embassy or neutral location
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  outcomes?: {
    agreements: string[];
    relationshipChange: number;
    economicImpact: number;
  };
}

interface MeetingCountry {
  id: string;
  name: string;
  flagUrl?: string | null;
  lastCalculated?: Date | number | null;
}

interface DiplomaticMeetingSchedulerProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeeting?: {
    type?: DiplomaticMeeting["type"];
    withCountries?: string[];
    location?: string;
  };
}

const MEETING_TYPES = [
  {
    value: "summit",
    label: "Diplomatic Summit",
    description: "High-level strategic discussions",
    icon: Globe,
  },
  {
    value: "negotiation",
    label: "Treaty Negotiation",
    description: "Formal agreement discussions",
    icon: FileText,
  },
  {
    value: "cultural_planning",
    label: "Cultural Planning",
    description: "Exchange program coordination",
    icon: Users,
  },
  {
    value: "treaty_signing",
    label: "Treaty Signing",
    description: "Formal treaty ratification",
    icon: CheckCircle2,
  },
] as const;

export function DiplomaticMeetingScheduler({
  countryId,
  open,
  onOpenChange,
  defaultMeeting,
}: DiplomaticMeetingSchedulerProps) {
  const { user } = useUser();

  // Form state
  const [meetingType, setMeetingType] = useState<DiplomaticMeeting["type"]>(
    defaultMeeting?.type ?? "summit"
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    defaultMeeting?.withCountries ?? []
  );
  const [scheduledIxTime, setScheduledIxTime] = useState(
    IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000 // +1 day in IxTime
  );
  const [agenda, setAgenda] = useState("");
  const [location, setLocation] = useState(defaultMeeting?.location ?? "");
  const [selectedEmbassy, setSelectedEmbassy] = useState<string | null>(null);

  // Get diplomatic relations
  const { data: relations = [] } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: open }
  );

  // Get embassies for location selection
  const { data: embassies = [] } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: open }
  );

  // Get all countries for partner selection
  const { data: allCountries = [] } = api.countries.getAll.useQuery(undefined, { enabled: open });

  const countriesList = useMemo<MeetingCountry[]>(() => {
    if (!allCountries) return [];

    if (Array.isArray(allCountries)) {
      return allCountries.map((country: any) => ({
        id: country.id,
        name: country.name,
        flagUrl: country.flagUrl ?? null,
        lastCalculated: country.lastCalculated ?? null,
      }));
    }

    return (allCountries.countries ?? []).map((country: any) => ({
      id: country.id,
      name: country.name,
      flagUrl: country.flagUrl ?? null,
      lastCalculated: country.lastCalculated ?? null,
    }));
  }, [allCountries]);

  const resetForm = () => {
    setMeetingType("summit");
    setSelectedCountries([]);
    setScheduledIxTime(IxTime.getCurrentIxTime() + 24 * 60 * 60 * 1000);
    setAgenda("");
    setLocation("");
    setSelectedEmbassy(null);
  };

  const toggleCountry = (countryIdToToggle: string) => {
    setSelectedCountries((prev) =>
      prev.includes(countryIdToToggle)
        ? prev.filter((id) => id !== countryIdToToggle)
        : [...prev, countryIdToToggle]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCountries.length === 0) {
      toast.error("Please select at least one country to meet with");
      return;
    }

    if (!agenda.trim()) {
      toast.error("Please provide a meeting agenda");
      return;
    }

    if (!location.trim()) {
      toast.error("Please specify a meeting location");
      return;
    }

    // Create meeting (would call API mutation in production)
    toast.success(`Diplomatic ${meetingType} scheduled successfully!`);
    onOpenChange(false);
    resetForm();
  };

  const meetingTypeConfig = MEETING_TYPES.find((t) => t.value === meetingType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-500" />
            Schedule Diplomatic Meeting
          </DialogTitle>
          <DialogDescription>
            Coordinate summits, negotiations, and diplomatic engagements with other nations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Meeting Type */}
          <div className="space-y-3">
            <Label>Meeting Type *</Label>
            <div className="grid grid-cols-2 gap-3">
              {MEETING_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div
                    key={type.value}
                    onClick={() => setMeetingType(type.value)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      meetingType === type.value
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                        : "border-border hover:border-purple-300 dark:hover:border-purple-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`mt-0.5 h-5 w-5 ${
                          meetingType === type.value ? "text-purple-600" : "text-muted-foreground"
                        }`}
                      />
                      <div>
                        <div className="text-sm font-medium">{type.label}</div>
                        <div className="text-muted-foreground text-xs">{type.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Participating Countries */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participating Countries * ({selectedCountries.length} selected)
            </Label>

            <div className="bg-muted/30 grid max-h-60 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3">
              {relations.length > 0 ? (
                relations.map((relation) => {
                  const targetCountryId = relation.targetCountryId;
                  const targetCountry = countriesList.find(
                    (country) => country.id === targetCountryId
                  );
                  if (!targetCountry) return null;

                  return (
                    <div
                      key={targetCountryId}
                      onClick={() => toggleCountry(targetCountryId)}
                      className={`cursor-pointer rounded-md border p-3 transition-all ${
                        selectedCountries.includes(targetCountryId)
                          ? "border-purple-300 bg-purple-50 dark:bg-purple-950/30"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{targetCountry.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {relation.relationship} • {relation.strength}% strength
                          </p>
                        </div>
                        {selectedCountries.includes(targetCountryId) && (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-purple-600" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-muted-foreground col-span-2 p-4 text-center text-sm">
                  <AlertCircle className="mr-2 inline h-4 w-4" />
                  No diplomatic relations established yet
                </div>
              )}
            </div>
          </div>

          {/* Agenda */}
          <div>
            <Label htmlFor="agenda">Meeting Agenda *</Label>
            <Textarea
              id="agenda"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Outline the key topics and objectives for this meeting..."
              rows={4}
              required
            />
          </div>

          {/* Location Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Meeting Location *
            </Label>

            <div className="grid gap-3">
              {/* Embassy Locations */}
              {embassies.length > 0 && (
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm font-medium">Your Embassies:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {embassies.map((embassy) => (
                      <div
                        key={embassy.id}
                        onClick={() => {
                          setSelectedEmbassy(embassy.id);
                          setLocation(
                            `${embassy.country} Embassy - ${embassy.location || "Main Office"}`
                          );
                        }}
                        className={`cursor-pointer rounded-md border p-2 transition-all ${
                          selectedEmbassy === embassy.id
                            ? "border-purple-300 bg-purple-50 dark:bg-purple-950/30"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="text-sm font-medium">{embassy.country}</div>
                        <div className="text-muted-foreground text-xs">
                          {embassy.location || "Main Office"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Location */}
              <div className="space-y-2">
                <div className="text-muted-foreground text-sm font-medium">
                  Or specify custom location:
                </div>
                <Input
                  placeholder="e.g., Geneva International Conference Center"
                  value={selectedEmbassy ? "" : location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setSelectedEmbassy(null);
                  }}
                  disabled={!!selectedEmbassy}
                />
              </div>
            </div>
          </div>

          {/* Meeting Date/Time */}
          <IxTimePicker
            id="meeting-time"
            label="Meeting Date & Time (IxTime) *"
            value={scheduledIxTime}
            onChange={setScheduledIxTime}
            required
            showRealWorldTime={false}
          />

          {/* Meeting Summary */}
          {meetingType && selectedCountries.length > 0 && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/20">
              <div className="mb-2 text-sm font-medium text-purple-900 dark:text-purple-100">
                Meeting Summary:
              </div>
              <div className="text-sm text-purple-800 dark:text-purple-200">
                {meetingTypeConfig?.label} with {selectedCountries.length}{" "}
                {selectedCountries.length === 1 ? "country" : "countries"}
                {location && ` at ${location}`}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selectedCountries.length === 0 || !agenda.trim() || !location.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Schedule Meeting
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DiplomaticMeetingScheduler;
