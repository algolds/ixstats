import { type Metadata } from "next";
import { headers } from "next/headers";
import { isStandaloneRequest } from "~/lib/system";

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
