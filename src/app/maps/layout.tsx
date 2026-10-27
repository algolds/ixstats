import { type Metadata } from "next";
import { PortalTintSync } from "~/components/providers/PortalTintSync";

export const metadata: Metadata = {
  title: "World Map - IxStates",
  description:
    "Explore the IxEarth world map. View countries, territories, and geographic features.",
};

export default function MapsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="maps" className="contents">
      <PortalTintSync />
      {children}
    </div>
  );
}
