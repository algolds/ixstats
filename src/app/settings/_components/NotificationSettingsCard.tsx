import { useState, useEffect } from "react";
import { Bell, Mail, TrendingUp, AlertTriangle, Globe, Settings, Loader2 } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface NotificationSettingsCardProps {
  userId: string;
}

type NotificationLevel = "low" | "medium" | "high" | "all";

export function NotificationSettingsCard({ userId }: NotificationSettingsCardProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  // Queries
  const { data: preferences, isLoading } = api.notifications.getPreferences.useQuery(
    { userId },
    {
      enabled: !!userId,
      refetchOnWindowFocus: false,
    }
  );

  // Mutations
  const updatePrefsMutation = api.notifications.upsertPreferences.useMutation({
    onSuccess: () => {
      notify.success("Notification preferences updated successfully.");
      void utils.notifications.getPreferences.invalidate({ userId });
    },
    onError: (err) => {
      notify.error("Failed to update preferences", err.message);
    },
  });

  // Local State
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [economicAlerts, setEconomicAlerts] = useState(true);
  const [crisisAlerts, setCrisisAlerts] = useState(true);
  const [diplomaticAlerts, setDiplomaticAlerts] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [notificationLevel, setNotificationLevel] = useState<NotificationLevel>("medium");

  // Sync state from query data
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

  // Handler for toggle switches
  const handleToggle = (field: string, checked: boolean) => {
    // Set local state immediately for snappy UX
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

    // Trigger background mutation
    updatePrefsMutation.mutate({
      userId,
      [field]: checked,
    });
  };

  // Handler for level dropdown
  const handleLevelChange = (level: NotificationLevel) => {
    setNotificationLevel(level);
    updatePrefsMutation.mutate({
      userId,
      notificationLevel: level,
    });
  };

  if (isLoading) {
    return (
      <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1">
        <div className="flex min-h-[400px] items-center justify-center rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <TextureOverlay texture="diagonal" opacity={0.03} />

        {/* Card Header */}
        <div className="relative z-10 mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Notification Preferences
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Manage how and when you receive simulation updates and alerts.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          {/* Section: Channels */}
          <div className="space-y-4">
            <span className="block text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Delivery Channels
            </span>

            {/* Email Notifications */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="email-notifications"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Email Notifications
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Receive economic digests, periodic updates, and security summaries.
                  </p>
                </div>
              </div>
              <Switch
                id="email-notifications"
                checked={emailNotifications}
                onCheckedChange={(checked) => handleToggle("emailNotifications", checked)}
                disabled={updatePrefsMutation.isPending}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            {/* Push Notifications */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="push-notifications"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Real-time Push Alerts
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Receive immediate desktop updates for active global events.
                  </p>
                </div>
              </div>
              <Switch
                id="push-notifications"
                checked={pushNotifications}
                onCheckedChange={(checked) => handleToggle("pushNotifications", checked)}
                disabled={updatePrefsMutation.isPending}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>
          </div>

          <hr className="border-slate-200/50 dark:border-slate-800/50" />

          {/* Section: Categories */}
          <div className="space-y-4">
            <span className="block text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Alert Categories
            </span>

            {/* Economic Alerts */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="economic-alerts"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Economic Alerts
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Market listings, auction wins/bids, tax changes, and economic reports.
                  </p>
                </div>
              </div>
              <Switch
                id="economic-alerts"
                checked={economicAlerts}
                onCheckedChange={(checked) => handleToggle("economicAlerts", checked)}
                disabled={updatePrefsMutation.isPending}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>

            {/* Crisis Alerts */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="crisis-alerts"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Crisis & Security Alerts
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Simulated crises, military developments, and border stability incidents.
                  </p>
                </div>
              </div>
              <Switch
                id="crisis-alerts"
                checked={crisisAlerts}
                onCheckedChange={(checked) => handleToggle("crisisAlerts", checked)}
                disabled={updatePrefsMutation.isPending}
                className="data-[state=checked]:bg-red-500"
              />
            </div>

            {/* Diplomatic Alerts */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="diplomatic-alerts"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Diplomatic Operations
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Embassy requests, alliance updates, and treaties signed by your country.
                  </p>
                </div>
              </div>
              <Switch
                id="diplomatic-alerts"
                checked={diplomaticAlerts}
                onCheckedChange={(checked) => handleToggle("diplomaticAlerts", checked)}
                disabled={updatePrefsMutation.isPending}
                className="data-[state=checked]:bg-cyan-500"
              />
            </div>

            {/* System Alerts */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="system-alerts"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    System Announcements
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Account events, software updates, and platform-wide moderation messages.
                  </p>
                </div>
              </div>
              <Switch
                id="system-alerts"
                checked={systemAlerts}
                onCheckedChange={(checked) => handleToggle("systemAlerts", checked)}
                disabled={updatePrefsMutation.isPending}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          </div>

          <hr className="border-slate-200/50 dark:border-slate-800/50" />

          {/* Section: Level */}
          <div className="flex flex-col gap-3 rounded-2xl bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800/30">
            <div>
              <Label
                htmlFor="notification-level"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Minimum Priority Level
              </Label>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Silence alerts that fall below your selected priority threshold.
              </p>
            </div>
            <select
              id="notification-level"
              value={notificationLevel}
              onChange={(e) => handleLevelChange(e.target.value as NotificationLevel)}
              disabled={updatePrefsMutation.isPending}
              className="w-full min-w-[150px] rounded-xl border border-slate-200/50 bg-white/50 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-white focus:ring-1 focus:ring-indigo-500/30 focus:outline-none sm:w-auto dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <option value="low">Low (All Alerts)</option>
              <option value="medium">Medium (Recommended)</option>
              <option value="high">High Priority</option>
              <option value="all">All Priorities</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
