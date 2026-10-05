"use client";

import { useState, useEffect } from "react";
import {
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

  const [economicAlerts, setEconomicAlerts] = useState(true);
  const [crisisAlerts, setCrisisAlerts] = useState(true);
  const [diplomaticAlerts, setDiplomaticAlerts] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [notificationLevel, setNotificationLevel] = useState<NotificationLevel>("low");

  useEffect(() => {
    if (preferences) {
      setEconomicAlerts(preferences.economicAlerts);
      setCrisisAlerts(preferences.crisisAlerts);
      setDiplomaticAlerts(preferences.diplomaticAlerts);
      setSystemAlerts(preferences.systemAlerts);
      setNotificationLevel((preferences.notificationLevel || "low") as NotificationLevel);
    }
  }, [preferences]);

  const handleToggle = (field: string, checked: boolean) => {
    switch (field) {
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
        category="Platform & preferences"
        description="Choose which in-app notifications reach you and how urgent they must be."
      />

      {/* Email and push delivery are not offered: notifications arrive in-app only. */}

      {/* Alert categories */}
      <SettingsGroup
        title="Alert categories"
        description="Choose which kinds of events notify you. Country-wide and global announcements always show."
      >
        <SettingsSwitchRow
          id="alert-economic"
          label="Economic events"
          description="Market listings, auction bids, tax changes and economic reports"
          icon={TrendingUp}
          glyphClass="bg-amber-500/15 text-amber-500"
          checked={economicAlerts}
          onCheckedChange={(checked) => handleToggle("economicAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />

        <SettingsSwitchRow
          id="alert-crisis"
          label="Crisis and security"
          description="Border incidents, military developments and stability events"
          icon={AlertTriangle}
          glyphClass="bg-rose-500/15 text-rose-500"
          checked={crisisAlerts}
          onCheckedChange={(checked) => handleToggle("crisisAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />

        <SettingsSwitchRow
          id="alert-diplomatic"
          label="Diplomacy"
          description="Embassy requests, alliance declarations and treaty signings"
          icon={Globe}
          glyphClass="bg-cyan-500/15 text-cyan-500"
          checked={diplomaticAlerts}
          onCheckedChange={(checked) => handleToggle("diplomaticAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />

        <SettingsSwitchRow
          id="alert-system"
          label="Platform notices"
          description="Account security events, releases and moderation"
          icon={Settings}
          glyphClass="bg-purple-500/15 text-purple-500"
          checked={systemAlerts}
          onCheckedChange={(checked) => handleToggle("systemAlerts", checked)}
          disabled={updatePrefsMutation.isPending}
        />
      </SettingsGroup>

      {/* Priority level */}
      <SettingsGroup
        title="Priority threshold"
        description="Hide notices below the priority you choose."
      >
        <SettingsSelectRow
          id="notif-level"
          label="Minimum urgency"
          description="Silence alerts below this priority"
          value={notificationLevel}
          onValueChange={handleLevelChange}
          disabled={updatePrefsMutation.isPending}
          options={[
            {
              value: "low",
              label: "Low (all alerts)",
              description: "Receive every alert regardless of urgency",
            },
            {
              value: "medium",
              label: "Medium (recommended)",
              description: "Skip routine background updates",
            },
            {
              value: "high",
              label: "High priority",
              description: "Only major crises and actions that need you",
            },
            { value: "all", label: "All priorities", description: "Every event, unfiltered" },
          ]}
        />
      </SettingsGroup>
    </div>
  );
}
