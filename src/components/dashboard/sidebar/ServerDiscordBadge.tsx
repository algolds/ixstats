import { Suspense } from "react";
import { DiscordBadge } from "~/components/ui/discord-badge";

/**
 * Server-side wrapper for DiscordBadge.
 * Renders the async server component with Suspense so it can be
 * slotted into client component trees via the children/props pattern.
 *
 * We pass `data` directly because the Ixnay Discord server has its
 * widget disabled, which means the widget API returns null.
 */
export function ServerDiscordBadge() {
  return (
    <Suspense
      fallback={
        <span className="bg-discord/30 inline-flex h-7 w-full animate-pulse items-center rounded-md px-2.5" />
      }
    >
      <DiscordBadge
        serverId="557016198932332565"
        inviteUrl="https://discord.gg/mgXAEYdqkd"
        data={{
          id: "557016198932332565",
          name: "Ixnay",
          instantInvite: "https://discord.gg/mgXAEYdqkd",
          onlineCount: 0,
        }}
        showOnline
        variant="outline"
        size="sm"
        iconStyle="discord"
        className="max-w-full"
      />
    </Suspense>
  );
}
