"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  StatUp as TrendingUp,
  WarningTriangle as AlertTriangle,
  Globe,
  Settings,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsSwitchRow, SettingsSelectRow } from "../primitives";

interface NotificationSettingsPanelProps {
  userId: string;
}

type NotificationLevel = "low" | "medium" | "high" | "all";

export function NotificationSettingsPanel({ userId }: NotificationSettingsPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: preferences } = api.notifications.getPreferences.useQuery(
    { userId },
    { enabled: Boolean(userId), refetchOnWindowFocus: false }
  );

  const updatePrefsMutation = api.notifications.upsertPreferences.useMutation({
    onSuccess: () => {
      notify.success("Notification preferences updated");
      void utils.notifications.getPreferences.invalidate({ userId });
    },
    onError: (err) => notify.error(err.message || "Failed to update preferences"),
  });

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [economicAlerts, setEconomicAlerts] = useState(true);
  const [crisisAlerts, setCrisisAlerts] = useState(true);
  const [diplomaticAlerts, setDiplomaticAlerts] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [notificationLevel, setNotificationLevel] = useState<NotificationLevel>("medium");

  useEffect(() => {
    if (preferences) {
      setEmailNotifications(preferences.emailNotifications);
      setPushNotifications(preferences.pushNotifications);
      setEconomicAlerts(preferences.economicAlerts);
      setCrisisAlerts(preferences.crisisAlerts);
      setDiplomaticAlerts(preferences.diplomaticAlerts);
      setSystemAlerts(preferences.systemAlerts);
      setNotificationLevel((preferences.notificationLevel || "medium") as NotificationLevel);
    }
  }, [preferences]);

  const handleToggle = (field: string, checked: boolean) => {
    switch (field) {
      case "emailNotifications":
        setEmailNotifications(checked);
        break;
      case "pushNotifications":
        setPushNotifications(checked);
        break;
      case "economicAlerts":
        setEconomicAlerts(checked);
        break;
      case "crisisAlerts":
        setCrisisAlerts(checked);
        break;
      case "diplomaticAlerts":
        setDiplomaticAlerts(checked);
        break;
      case "systemAlerts":
        setSystemAlerts(checked);
        break;
    }

    updatePrefsMutation.mutate({
      userId,
      [field]: checked,
    });
  };

  const handleLevelChange = (level: string) => {
    setNotificationLevel(level as NotificationLevel);
    updatePrefsMutation.mutate({
      userId,
      notificationLevel: level as NotificationLevel,
    });
  };

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Notifications"
        category="Platform & Preferences"
        description="Choose delivery methods, urgency thresholds, and event categories for simulation alerts."
      />

      {/* Delivery Channels */}
      <SettingsGroup
        title="Delivery Channels"
        description="Where updates and urgent dispatches are sent."
      >
        <SettingsSwitchRow
          id="email-channel"
          label="Email Summaries"
          description="Periodic digests, monthly economic reports, and security summaries"
          icon={Mail}
          glyphClass="bg-blue-500/15 text-blue-500"
          checked={emailNotifications}
          onCheckedChange={(checked) => handleToggle("emailNotifications", checked)}
          disabled={updatePrefsMutation.isPending}
        />

        <SettingsSwitchRow
          id="push-channel"
          label="Desktop Push Alerts"
          description="Immediate real-time browser alerts for breaking geopolitical events"
          icon={Bell}
          glyphClass="bg-indigo-500/15 text-indigo-500"
          checked={pushNotifications}
          onCheckedChange={(checked) => handleToggle("pushNotifications", checked)}
          disabled={updatePrefsMutation.isPending}
        />
      </SettingsGroup>

      {/* Alert Categories */}
      <SettingsGroup
        title="Alert Categories"
        description="Select which simulation domains trigger dispatches."
      >
        <SettingsSwitchRow
          id="alert-economic"
          label="Economic Events"
          description="Market listings, auction bids, tax changes, and economic reports"
          icon={TrendingUp}
          glyphClass="bg-amber-500/15 text-amber-500"
          checked={economicAlerts}
          onCheckedChange={(checked) => handleToggle("economicAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />

        <SettingsSwitchRow
          id="alert-crisis"
          label="Crisis & Security"
          description="Border incidents, military developments, and stability events"
          icon={AlertTriangle}
          glyphClass="bg-rose-500/15 text-rose-500"
          checked={crisisAlerts}
          onCheckedChange={(checked) => handleToggle("crisisAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />

        <SettingsSwitchRow
          id="alert-diplomatic"
          label="Diplomatic Operations"
          description="Embassy requests, alliance declarations, and treaty signings"
          icon={Globe}
          glyphClass="bg-cyan-500/15 text-cyan-500"
          checked={diplomaticAlerts}
          onCheckedChange={(checked) => handleToggle("diplomaticAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />

        <SettingsSwitchRow
          id="alert-system"
          label="Platform Notices"
          description="Account security events, software releases, and platform moderation"
          icon={Settings}
          glyphClass="bg-purple-500/15 text-purple-500"
          checked={systemAlerts}
          onCheckedChange={(checked) => handleToggle("systemAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />
      </SettingsGroup>

      {/* Priority Level */}
      <SettingsGroup
        title="Priority Threshold"
        description="Filter out lower urgency notices below your chosen priority level."
      >
        <SettingsSelectRow
          id="notif-level"
          label="Minimum Urgency"
          description="Silence dispatches that fall below this priority rating"
          value={notificationLevel}
          onValueChange={handleLevelChange}
          disabled={updatePrefsMutation.isPending}
          options={[
            {
              value: "low",
              label: "Low (All Alerts)",
              description: "Receive all dispatches regardless of urgency",
            },
            {
              value: "medium",
              label: "Medium (Recommended)",
              description: "Filter out routine background updates",
            },
            {
              value: "high",
              label: "High Priority",
              description: "Only breaking crises and direct actions",
            },
            { value: "all", label: "All Priorities", description: "Unfiltered event firehose" },
          ]}
        />
      </SettingsGroup>
    </div>
  );
}
