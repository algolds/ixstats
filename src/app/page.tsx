import { HomeClient } from "./_components/HomeClient";
import { ServerDiscordBadge } from "~/components/dashboard/sidebar/ServerDiscordBadge";


export default function Home() {
  return <HomeClient discordBadge={<ServerDiscordBadge />} />;
}
