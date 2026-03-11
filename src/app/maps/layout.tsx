import { type Metadata } from "next";

const isStandalone =
  process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true";

export const metadata: Metadata = {
  title: isStandalone
    ? "IxWorld - Interactive World Map"
    : "World Map - IxStats",
  description:
    "Explore the IxEarth world map. View countries, territories, and geographic features.",
};

export default function MapsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
