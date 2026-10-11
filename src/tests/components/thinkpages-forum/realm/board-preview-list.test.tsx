import React from "react";
import { render, screen } from "@testing-library/react";
import { BoardPreviewList } from "~/components/thinkpages-forum/realm/BoardPreviewList";
import type { BoardPreviewMessage } from "~/lib/thinkpages-forum/preview";

const message = (over: Partial<BoardPreviewMessage> = {}): BoardPreviewMessage => ({
  id: "p1",
  author: { name: "jane", avatarUrl: null, flagUrl: "https://flags.example/e.png", persona: false },
  excerpt: "Trade talks resume on Monday.",
  createdAt: new Date(Date.now() - 5 * 60_000),
  href: "/thinkpages/r/eurth#post-p1",
  ...over,
});

describe("BoardPreviewList", () => {
  it("lists each message as one link to its place on the board", () => {
    render(
      <BoardPreviewList
        messages={[
          message(),
          message({ id: "p2", href: "/thinkpages/r/eurth#post-p2", excerpt: "Second" }),
        ]}
      />
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/thinkpages/r/eurth#post-p1",
      "/thinkpages/r/eurth#post-p2",
    ]);
    expect(links[0]).toHaveTextContent("jane");
    expect(links[0]).toHaveTextContent("Trade talks resume on Monday.");
    expect(links[0]).toHaveTextContent("5m ago");
  });

  it("keeps each link at the coarse-pointer touch height", () => {
    render(<BoardPreviewList messages={[message()]} />);
    expect(screen.getByRole("link").className).toContain("pointer-coarse:min-h-11");
  });

  it("shows the flag of a member and none for a persona", () => {
    const { container } = render(
      <BoardPreviewList
        messages={[
          message(),
          message({
            id: "p2",
            author: { name: "Eurth Daily", avatarUrl: null, flagUrl: null, persona: true },
          }),
        ]}
      />
    );
    expect(container.querySelectorAll("img[src='https://flags.example/e.png']")).toHaveLength(1);
    expect(screen.getByText("Eurth Daily")).toBeInTheDocument();
  });

  it("clamps a long excerpt to two lines and omits an empty one", () => {
    const { container } = render(
      <BoardPreviewList
        messages={[message({ excerpt: "x ".repeat(40) }), message({ id: "p2", excerpt: "" })]}
      />
    );
    expect(container.querySelectorAll(".line-clamp-2")).toHaveLength(1);
  });

  it("passes className to the list", () => {
    const { container } = render(<BoardPreviewList messages={[message()]} className="mt-3" />);
    expect(container.querySelector("ul")).toHaveClass("mt-3");
  });
});
