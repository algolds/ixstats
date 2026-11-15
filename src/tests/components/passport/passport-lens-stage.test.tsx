/** Passport Lens stage: guilloché security rosettes + monogram lattice behind Facet Lens glass. */
import React from "react";
import { render, screen } from "@testing-library/react";
import { guillochePaths, guillochePlanePaths } from "~/lib/passport/guilloche";
import {
  PassportFrontFace,
  type PassportFaceData,
} from "~/components/passport/document/PassportFrontFace";

jest.mock("~/components/shared/country-actions/CountryLink", () => ({
  CountryLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
jest.mock("~/components/share/ShareSheet", () => ({
  ShareSheet: () => <button type="button">Share</button>,
}));

const sampleFace: PassportFaceData = {
  handle: "ada",
  online: true,
  realmCount: 2,
  nationCount: 2,
  primaryNation: {
    name: "Ixnay",
    slug: "ixnay",
    role: "founder",
    country: { name: "Caphiria", slug: "caphiria", flagUrl: null },
  },
  account: { createdAt: "2024-06-01T00:00:00Z", signature: "A. Lovelace" },
  wiki: { lorewards: { totalScore: 420, rank: 3 } },
  thinkpages: { bio: "Analytical engines and statecraft." },
};

describe("Passport Lens stage & guilloché planes", () => {
  it("partitions guillochePaths into far and near parallax planes without dropping strands", () => {
    const all = guillochePaths(1200, 630);
    const { far, near } = guillochePlanePaths(1200, 630);
    expect(far.length).toBeGreaterThan(0);
    expect(near.length).toBeGreaterThan(0);
    expect(far.length + near.length).toBe(all.length);
    expect(new Set([...far, ...near])).toEqual(new Set(all));
  });

  it("renders PassportFrontFace over the monogram + dual-plane guilloché stage under Facet Lens glass", () => {
    const { container } = render(
      <PassportFrontFace
        data={sampleFace}
        displayName="Ada Lovelace"
        avatarUrl={null}
        cosmetics={null}
        isOwner
        viewerSignedIn
        onEdit={jest.fn()}
        onOpenLorewards={jest.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    const stage = container.querySelector('[data-slot="passport-lens-stage"]');
    expect(stage).not.toBeNull();
    expect(stage?.querySelector(".facet-monogram")).not.toBeNull();
    const planes = stage?.querySelectorAll("svg");
    expect(planes).toHaveLength(2);
    planes?.forEach((svg) => {
      expect(svg.getAttribute("class")).toContain("transparency-reduced:hidden");
      expect(svg.getAttribute("class")).toContain("contrast-more:hidden");
    });

    const lens = container.querySelector('[data-slot="facet-material"][data-layer="lens"]');
    expect(lens).not.toBeNull();
    expect(lens?.className).toContain("facet-lens");
  });
});
