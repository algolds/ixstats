import { render, screen } from "@testing-library/react";
import { MentionMenuPortal } from "~/components/shared/editor/MentionMenuPortal";

const base = {
  coords: { top: 0, left: 0 },
  selectedIndex: 0,
  onSelect: jest.fn(),
  query: "",
  isLoading: false,
};

describe("MentionMenuPortal", () => {
  it("shows a source row with an avatar initial, no glyph, and no repeated subline", () => {
    render(
      <MentionMenuPortal
        {...base}
        results={[
          {
            type: "user",
            id: "user:kirsten",
            name: "@kirsten",
            description: "",
            icon: "",
            avatar: { url: null },
          },
          {
            type: "user",
            id: "persona:KirNews",
            name: "@KirNews",
            title: "Kir News",
            description: "@KirNews",
            icon: "",
            avatar: { url: null },
          },
        ]}
      />
    );
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent(/^K@kirsten$/);
    expect(rows[1]).toHaveTextContent(/^KKir News@KirNews$/);
    expect(document.body.textContent).not.toMatch(/\u{1F464}/u);
  });

  it("keeps the icon box for rows without an avatar", () => {
    render(
      <MentionMenuPortal
        {...base}
        results={[
          { type: "league", id: "l1", name: "Owl League", description: "Sports League", icon: "L" },
        ]}
      />
    );
    expect(screen.getByRole("button")).toHaveTextContent("LOwl LeagueSports League");
  });
});
