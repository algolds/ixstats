import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { OnomaHeader } from "~/app/labs/onoma/components/nav/OnomaHeader";

describe("OnomaHeader navigation", () => {
  const defaultProps = {
    activeSection: "overview" as const,
    activeSubTab: "workshop" as const,
    activeExploreSubTab: "phonology" as const,
    lastActiveTab: "overview" as const,
    shouldAnimateStash: false,
    hasInteractedPronunciation: false,
    setHasInteractedPronunciation: () => {},
    playPronunciation: () => {},
    onOpenHelp: () => {},
    onNavigate: () => {},
    onNavigateStudio: () => {},
    onNavigateExplore: () => {},
  };

  it("hides the Glyphs link and renders Create tabs without icons", () => {
    render(
      <TooltipProvider>
        <OnomaHeader {...defaultProps} />
      </TooltipProvider>
    );

    expect(screen.queryByRole("link", { name: /glyphs/i })).toBeNull();
    expect(screen.queryByText("Glyphs")).toBeNull();

    const createTabs = screen.getByRole("radiogroup", { name: "Create sections" });
    for (const label of ["Sandbox", "Places", "People", "Factions", "Culture"]) {
      const tab = within(createTabs).getByRole("radio", { name: label });
      expect(tab.querySelector("svg")).toBeNull();
    }
  });
});
