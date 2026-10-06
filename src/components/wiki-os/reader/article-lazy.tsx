"use client";

import dynamic from "next/dynamic";

// The margin suite is an interaction, not the first paint: each piece is its own chunk. A drawer or
// modal is fetched when first opened; the capsule and the gutter pins (which need the page's own
// selection and text) load right after hydration, off the critical path.
export const MarginGutterPins = dynamic(
  () => import("~/components/wiki-os/margin/MarginGutterPins").then((m) => m.MarginGutterPins),
  { ssr: false }
);
export const SelectionCapsule = dynamic(
  () => import("~/components/wiki-os/margin/SelectionCapsule").then((m) => m.SelectionCapsule),
  { ssr: false }
);
export const WikiMarginDrawer = dynamic(
  () => import("~/components/wiki-os/margin/WikiMarginDrawer").then((m) => m.WikiMarginDrawer),
  { ssr: false }
);
export const MarginShareModal = dynamic(
  () =>
    import("~/components/wiki-os/margin/modals/MarginShareModal").then((m) => m.MarginShareModal),
  { ssr: false }
);

export const CoordinatesMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CoordinatesMapEmbed").then((m) => ({
      default: m.CoordinatesMapEmbed,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="wikios-ixworld-loading rounded-row border-separator bg-fill-4 flex min-h-[200px] items-center justify-center border">
        <div
          className="wikios-loading-spinner mr-2 animate-spin"
          style={{ width: 20, height: 20 }}
        />
        <span className="text-footnote text-label-secondary">Loading map...</span>
      </div>
    ),
  }
);
