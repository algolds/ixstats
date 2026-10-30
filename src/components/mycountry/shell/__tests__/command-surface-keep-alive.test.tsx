/**
 * Sections the player has visited stay mounted while hidden (React `Activity`): switching back
 * keeps their state and skips the skeleton, and a hidden section runs none of its effects.
 */
import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandSurface } from "../CommandSurface";

const effectRan = jest.fn<void, [string]>();

jest.mock("next/navigation", () => ({
  usePathname: () => "/mycountry",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { id: "country-1" } }),
}));
jest.mock("~/context/theme-context", () => ({ useTheme: () => ({ compactMode: false }) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ success: jest.fn() }) }));
jest.mock("../headers/UnifiedGlassCommandBar", () => ({ UnifiedGlassCommandBar: () => null }));
jest.mock("../ExecutiveConsole", () => ({ ExecutiveConsole: () => null }));
jest.mock("~/components/mycountry/shell/DrillSheets", () => ({ DrillSheets: () => null }));

function Stub({ label }: { label: string }) {
  useEffect(() => {
    effectRan(label);
  });
  return <input aria-label={label} />;
}
jest.mock("../DomainSurface", () => ({
  DomainSurface: ({ section }: { section: string }) => <Stub key={section} label={section} />,
}));
jest.mock("../ExecutiveHome", () => ({ ExecutiveHome: () => <Stub label="overview" /> }));

describe("CommandSurface keeps visited sections mounted", () => {
  beforeEach(() => effectRan.mockClear());

  it("keeps a visited section's state when switching away and back", () => {
    const { rerender } = render(<CommandSurface section="economy" />);
    fireEvent.change(screen.getByLabelText("economy"), { target: { value: "x" } });

    rerender(<CommandSurface section="diplomacy" />);
    rerender(<CommandSurface section="economy" />);

    expect(screen.getByLabelText("economy")).toHaveValue("x");
  });

  it("hides the inactive section and stops its effects", () => {
    const { rerender } = render(<CommandSurface section="economy" />);
    rerender(<CommandSurface section="diplomacy" />);

    expect(screen.getByLabelText("economy")).not.toBeVisible();
    expect(screen.getByLabelText("diplomacy")).toBeVisible();

    effectRan.mockClear();
    rerender(<CommandSurface section="diplomacy" onNavigate={jest.fn()} />);

    expect(effectRan).not.toHaveBeenCalledWith("economy");
    expect(effectRan).toHaveBeenCalledWith("diplomacy");
  });

  it("mounts only the sections that were visited", () => {
    render(<CommandSurface section="economy" />);

    expect(screen.queryByLabelText("diplomacy")).toBeNull();
    expect(screen.queryByLabelText("overview")).toBeNull();
  });

  it("mounts nothing behind the executive console", () => {
    render(<CommandSurface section="executive" />);

    expect(screen.queryByRole("textbox", { hidden: true })).toBeNull();
  });
});
