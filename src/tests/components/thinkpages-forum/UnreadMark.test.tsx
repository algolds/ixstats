import { render, screen } from "@testing-library/react";
import { UnreadCount, UnreadMark } from "~/components/thinkpages-forum/UnreadMark";

describe("UnreadMark", () => {
  it("is a tint dot read as Unread", () => {
    const { container } = render(<UnreadMark />);
    expect(container.querySelector(".bg-tint.rounded-full")).not.toBeNull();
    expect(screen.getByText("Unread")).toHaveClass("sr-only");
  });
});

describe("UnreadCount", () => {
  it("is a quiet count", () => {
    render(<UnreadCount count={4} />);
    expect(screen.getByText("4 new")).toHaveClass("text-footnote", "text-label-secondary");
  });

  it("adds its context after the count when given a suffix", () => {
    render(<UnreadCount count={4} suffix="on the board" />);
    expect(screen.getByText("4 new on the board")).toHaveClass("text-footnote");
  });

  it("caps a large count at 99+", () => {
    render(<UnreadCount count={100} />);
    expect(screen.getByText("99+ new")).toBeInTheDocument();
  });
});
