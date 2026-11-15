import { fireEvent, render, screen } from "@testing-library/react";

let mockIssues: Array<Record<string, unknown>> = [];
let mockCardImages: Record<string, { imageUrl: string }> | undefined;
let mockCoverArticles:
  Record<"economy" | "state" | "foreign", Array<{ imageUrl: string | null }>> | undefined;

jest.mock("~/trpc/react", () => ({
  api: {
    intent: { getTree: { useQuery: () => ({ data: [] }) } },
    policies: {
      getPolicyReconContext: {
        useQuery: () => ({ data: { capacity: 100, used: 25, overCapacity: false } }),
      },
    },
    nationalIssues: {
      getMyIssues: {
        useQuery: () => ({ data: { issues: mockIssues } }),
      },
    },
    cardImages: {
      getAllByCountry: {
        useQuery: () => ({ data: mockCardImages }),
      },
    },
    countries: {
      getCoverArticles: {
        useQuery: () => ({ data: mockCoverArticles }),
      },
    },
  },
}));

jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { name: "Caphiria" } }),
}));

import { ExecutiveOpportunityHero } from "~/components/mycountry/shell/ExecutiveOpportunityHero";

afterEach(() => {
  mockIssues = [];
  mockCardImages = undefined;
  mockCoverArticles = undefined;
  window.sessionStorage.clear();
});

describe("ExecutiveOpportunityHero dynamic category backdrop", () => {
  it("renders a dynamic category backdrop from pinned country art, falling back to wiki and editorial art on error", () => {
    mockIssues = [
      {
        id: "iss-diplo-1",
        title: "Border treaty renegotiation",
        description: "Neighboring envoys have requested emergency talks.",
        severity: "critical",
        urgency: 90,
        domain: "diplomatic",
        category: "diplomatic",
      },
    ];
    mockCardImages = {
      diplomacy: { imageUrl: "https://cdn.example.com/pinned-embassy.jpg" },
    };
    mockCoverArticles = {
      economy: [],
      state: [],
      foreign: [
        { imageUrl: "https://cdn.example.com/flag.svg" },
        { imageUrl: "https://cdn.example.com/wiki-summit.jpg" },
      ],
    };

    const { container } = render(<ExecutiveOpportunityHero countryId="c1" />);

    expect(screen.getByText("Priority national issue · Diplomatic")).toBeTruthy();
    const backdrop = container.querySelector('[data-slot="priority-backdrop"]');
    expect(backdrop?.getAttribute("data-category")).toBe("diplomatic");

    const img = backdrop?.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/pinned-embassy.jpg");

    // Simulate pinned image failing: falls through to non-SVG WikiOS cover article
    fireEvent.error(img!);
    const secondImg = container.querySelector('[data-slot="priority-backdrop"] img');
    expect(secondImg?.getAttribute("src")).toBe("https://cdn.example.com/wiki-summit.jpg");

    // Simulate wiki image failing: falls through to curated category editorial pool
    fireEvent.error(secondImg!);
    const thirdImg = container.querySelector('[data-slot="priority-backdrop"] img');
    expect(thirdImg?.getAttribute("src")).toContain("https://images.unsplash.com/");
  });

  it("switches category backdrop dynamically when the issue domain changes", () => {
    mockIssues = [
      {
        id: "iss-env-1",
        title: "Watershed reservoir drought",
        description: "Reservoir levels fell below seasonal thresholds.",
        severity: "high",
        urgency: 80,
        domain: "environmental",
        category: "crisis",
      },
    ];

    const { container } = render(<ExecutiveOpportunityHero countryId="c1" />);

    expect(screen.getByText("Priority national issue · Environmental")).toBeTruthy();
    const backdrop = container.querySelector('[data-slot="priority-backdrop"]');
    expect(backdrop?.getAttribute("data-category")).toBe("environmental");
    expect(backdrop?.querySelector("img")?.getAttribute("src")).toContain(
      "https://images.unsplash.com/"
    );
  });
});
