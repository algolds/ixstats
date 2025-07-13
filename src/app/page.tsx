import Link from "next/link";
import { api, HydrateClient } from "~/trpc/server";
import { CommandCenter } from "./_components/CommandCenter";

export default async function Home() {
  return (
    <HydrateClient>
      <CommandCenter />
    </HydrateClient>
  );
}