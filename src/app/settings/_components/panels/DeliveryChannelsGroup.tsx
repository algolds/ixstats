"use client";

import { useState } from "react";
import { Mail, BellNotification, Calendar } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsGroup, SettingsSwitchRow } from "../primitives";
import { pushSupported, subscribeToPush, unsubscribeFromPush } from "../../_lib/push-subscription";

const GLYPH = "bg-muted/60 text-foreground";

interface DeliveryPreferences {
  emailNotifications: boolean;
  emailEnabledAt: Date | string | null;
  emailDigest: boolean;
  pushNotifications: boolean;
}

/**
 * Email and push delivery (SL-5). Each switch appears only when the server has that channel
 * configured (`notifications.getDeliveryChannels`). Email is opt-in and sends high and critical
 * notifications, or one daily digest; push goes to the browsers where it was turned on.
 */
export function DeliveryChannelsGroup({
  userId,
  preferences,
}: {
  userId: string;
  preferences: DeliveryPreferences | undefined;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [pushBusy, setPushBusy] = useState(false);
  const { data: channels } = api.notifications.getDeliveryChannels.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const refresh = () => {
    void utils.notifications.getPreferences.invalidate({ userId });
    void utils.notifications.getDeliveryChannels.invalidate();
  };
  const update = api.notifications.upsertPreferences.useMutation({
    onSuccess: () => {
      notify.success("Notification preferences updated");
      refresh();
    },
    onError: (err) => notify.error(err.message || "Failed to update preferences"),
  });
  const savePush = api.notifications.savePushSubscription.useMutation();
  const removePush = api.notifications.removePushSubscription.useMutation();

  if (!channels || (!channels.email && !channels.push)) return null;

  const emailOn = Boolean(preferences?.emailNotifications && preferences.emailEnabledAt);
  const pushOn = Boolean(preferences?.pushNotifications && channels.pushSubscriptionCount > 0);

  const togglePush = async (checked: boolean) => {
    setPushBusy(true);
    try {
      if (checked) {
        const subscription = channels.vapidPublicKey
          ? await subscribeToPush(channels.vapidPublicKey)
          : null;
        if (!subscription) {
          notify.error("Notifications are blocked or unsupported in this browser");
          return;
        }
        await savePush.mutateAsync(subscription);
      } else {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await removePush.mutateAsync({ endpoint });
      }
      await update.mutateAsync({ userId, pushNotifications: checked });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to change push notifications");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <SettingsGroup
      title="Delivery"
      description="Also receive notifications outside IxStats. Country-wide and global announcements stay in-app."
    >
      {channels.email && (
        <SettingsSwitchRow
          id="delivery-email"
          label="Email"
          description="Email high and critical notifications to your account's primary address"
          icon={Mail}
          glyphClass={GLYPH}
          checked={emailOn}
          onCheckedChange={(checked) => update.mutate({ userId, emailNotifications: checked })}
          disabled={update.isPending}
        />
      )}
      {channels.email && emailOn && (
        <SettingsSwitchRow
          id="delivery-email-digest"
          label="Daily digest"
          description="One summary email a day of everything new, instead of separate emails"
          icon={Calendar}
          glyphClass={GLYPH}
          checked={Boolean(preferences?.emailDigest)}
          onCheckedChange={(checked) => update.mutate({ userId, emailDigest: checked })}
          disabled={update.isPending}
        />
      )}
      {channels.push && (
        <SettingsSwitchRow
          id="delivery-push"
          label="Push notifications"
          description={
            pushSupported()
              ? "Show notifications from this browser, even when IxStats is closed"
              : "This browser does not support push notifications"
          }
          icon={BellNotification}
          glyphClass={GLYPH}
          checked={pushOn}
          onCheckedChange={(checked) => void togglePush(checked)}
          disabled={pushBusy || update.isPending || !pushSupported()}
        />
      )}
    </SettingsGroup>
  );
}
