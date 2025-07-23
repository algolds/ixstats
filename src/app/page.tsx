import { HydrateClient } from "~/trpc/server";
import { CommandCenter } from "./_components/CommandCenter";

export default function Home() {
  // Landing page - show CommandCenter without authentication checks
  // Authentication and redirects will be handled client-side if needed
  return (
    <HydrateClient>
      <CommandCenter />
    </HydrateClient>
  );
}