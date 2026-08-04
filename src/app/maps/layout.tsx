import { type Metadata } from "next";
import { headers } from "next/headers";
import { isStandaloneRequest } from "~/lib/standalone-detection";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const standalone = isStandaloneRequest(headersList);
  return {
    title: standalone ? "IxWorld - Interactive World Map" : "World Map - IxStates",
    description:
      "Explore the IxEarth world map. View countries, territories, and geographic features.",
  };
}

export default function MapsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
