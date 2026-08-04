import { HomeClient } from "./_components/HomeClient";
import { ServerDiscordBadge } from "~/components/dashboard/sidebar/ServerDiscordBadge";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function Home() {
  return <HomeClient discordBadge={<ServerDiscordBadge />} />;
}
