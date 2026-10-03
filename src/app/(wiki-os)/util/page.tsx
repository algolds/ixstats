// src/app/(wiki-os)/util/page.tsx
// WikiOS Special Directory & Utilities Deck
import type { Metadata } from "next";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { WikiOSUtilitiesDeck } from "~/components/wiki-os/utilities/WikiOSUtilitiesDeck";

export const metadata: Metadata = {
  title: "Special directory & utilities | WikiOS",
  description:
    "Native macOS-inspired utility deck replacing legacy MediaWiki Special Pages with high-speed tools.",
};

export default function WikiUtilitiesPage() {
  return (
    <WikiOSLayout title="Special directory & utilities" hideTitleHeading={true}>
      <WikiOSUtilitiesDeck />
    </WikiOSLayout>
  );
}
