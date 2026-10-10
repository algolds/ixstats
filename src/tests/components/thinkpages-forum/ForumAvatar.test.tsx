import React from "react";
import { render, screen } from "@testing-library/react";

import { ForumAvatar, initialsOf } from "~/components/thinkpages-forum/ForumAvatar";

describe("initialsOf", () => {
  it("takes up to two capital letters, and ? for no name", () => {
    expect(initialsOf("E2E Testland")).toBe("ET");
    expect(initialsOf("rhea_e2e")).toBe("R");
    expect(initialsOf("Aria Vance Third")).toBe("AV");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("ForumAvatar", () => {
  it("shows the person's initials on the app tint, not a grey disc, without a picture", () => {
    render(<ForumAvatar name="Aria Vance" />);
    const fallback = screen.getByText("AV");
    expect(fallback).toHaveClass("bg-tint-fill", "text-tint-ink");
    expect(fallback).not.toHaveClass("bg-fill-3");
  });

  it("sizes the disc and keeps a caller's class", () => {
    const { container } = render(<ForumAvatar name="Kir" size="lg" className="sm:size-12" />);
    const avatar = container.querySelector('[data-slot="avatar"]')!;
    expect(avatar).toHaveClass("size-10", "sm:size-12");
  });

  it("falls back to the initials while a picture has not loaded", () => {
    // Radix renders the image only once the browser reports it loaded; until then the fallback is what shows.
    render(<ForumAvatar name="Kir" avatarUrl="/avatars/kir.png" />);
    expect(screen.getByText("K")).toBeInTheDocument();
  });
});
