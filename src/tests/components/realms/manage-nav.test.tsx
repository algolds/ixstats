import { render, screen } from "@testing-library/react";
import { ManageNav } from "~/app/r/[realm]/_components/manage/ManageNav";

let mockActive: string | null = "rules";
const mockSpyIds = jest.fn((ids: readonly string[]) => ids);

jest.mock("~/components/country-profile/useScrollSpy", () => ({
  useScrollSpy: (ids: readonly string[]) => {
    mockSpyIds(ids);
    return mockActive;
  },
}));
jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));

const GROUPS = [
  { label: "Profile", sections: [{ id: "appearance", label: "Appearance" }] },
  {
    label: "Content",
    sections: [
      { id: "factbook", label: "Factbook" },
      { id: "rules", label: "Rules" },
    ],
  },
];

describe("ManageNav", () => {
  beforeAll(() => {
    Element.prototype.scrollBy = jest.fn();
  });

  it("watches every section in page order", () => {
    render(<ManageNav groups={GROUPS} />);
    expect(mockSpyIds).toHaveBeenLastCalledWith(["appearance", "factbook", "rules"]);
  });

  it("marks only the section being read as current", () => {
    render(<ManageNav groups={GROUPS} />);
    expect(screen.getByRole("link", { name: "Rules" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Factbook" })).not.toHaveAttribute("aria-current");
  });

  it("follows the reader to the next section", () => {
    const { rerender } = render(<ManageNav groups={GROUPS} />);
    mockActive = "appearance";
    rerender(<ManageNav groups={[...GROUPS]} />);
    expect(screen.getByRole("link", { name: "Appearance" })).toHaveAttribute(
      "aria-current",
      "location"
    );
    expect(screen.getByRole("link", { name: "Rules" })).not.toHaveAttribute("aria-current");
    mockActive = "rules";
  });
});
