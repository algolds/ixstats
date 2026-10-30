/**
 * Switching sections is a transition, so the section body sits inside a `ViewTransition` and the
 * browser cross-fades it. The wrapper holds the whole kept-alive list, not each section.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { CommandSurface } from "../CommandSurface";

jest.mock("react", () => ({
  ...jest.requireActual<typeof import("react")>("react"),
  ViewTransition: ({ children, default: className }: { children: ReactNode; default?: string }) => (
    <div data-testid="vt" data-class={className}>
      {children}
    </div>
  ),
}));
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
jest.mock("../DomainSurface", () => ({
  DomainSurface: ({ section }: { section: string }) => <p>{section}</p>,
}));
jest.mock("../ExecutiveHome", () => ({ ExecutiveHome: () => <p>overview</p> }));

describe("CommandSurface section cross-fade", () => {
  it("wraps the section body in a ViewTransition", () => {
    render(<CommandSurface section="economy" />);

    expect(screen.getByTestId("vt")).toContainElement(screen.getByText("economy"));
  });

  it("uses one wrapper for every kept section, with the section fade class", () => {
    const { rerender } = render(<CommandSurface section="economy" />);
    rerender(<CommandSurface section="diplomacy" />);

    const wrappers = screen.getAllByTestId("vt");
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]).toHaveAttribute("data-class", "mycountry-section");
    expect(wrappers[0]).toContainElement(screen.getByText("economy"));
    expect(wrappers[0]).toContainElement(screen.getByText("diplomacy"));
  });
});
