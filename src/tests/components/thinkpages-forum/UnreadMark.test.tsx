import { render, screen } from "@testing-library/react";
import { UnreadMark } from "~/components/thinkpages-forum/UnreadMark";

describe("UnreadMark", () => {
  it("is a tint dot read as Unread when there is no count", () => {
    const { container } = render(<UnreadMark />);
    expect(container.querySelector(".bg-tint.rounded-full")).not.toBeNull();
    expect(screen.getByText("Unread")).toHaveClass("sr-only");
  });

  it("adds a quiet count when given one", () => {
    render(<UnreadMark count={4} />);
    expect(screen.getByText("4 new")).toHaveClass("text-footnote", "text-label-secondary");
  });

  it("caps a large count at 99+", () => {
    render(<UnreadMark count={100} />);
    expect(screen.getByText("99+ new")).toBeInTheDocument();
  });
});
