import { fireEvent, render, screen } from "@testing-library/react";
import { MessageTrayItem } from "~/components/halo/views/tray/MessageTrayItem";
import { NarratorProgress } from "~/components/halo/views/compact/NarratorProgress";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as never;
const conversation = { id: "c1", title: "Caphiria", unreadCount: 1, messages: [] };

describe("Halo keyboard paths", () => {
  it.each(["Enter", " "])("opens a conversation with %p", (key) => {
    const onClick = jest.fn();
    render(
      <MessageTrayItem conversation={conversation} relativeTime={() => "now"} onClick={onClick} />
    );
    const row = screen.getByRole("button", { name: /Caphiria/ });
    expect(fireEvent.keyDown(row, { key })).toBe(false); // default prevented: Space does not scroll
    expect(onClick).toHaveBeenCalledWith(conversation);
  });

  it("draws the focus ring inside the row so the clipping parent cannot hide it", () => {
    render(
      <MessageTrayItem conversation={conversation} relativeTime={() => "now"} onClick={jest.fn()} />
    );
    expect(screen.getByRole("button", { name: /Caphiria/ }).className).toContain(
      "focus-visible:-outline-offset-2"
    );
  });

  it("eases the progress fill with the Facet token", () => {
    render(<NarratorProgress value={10} color="var(--tint)" />);
    const fill = screen.getByRole("progressbar").firstElementChild;
    expect(fill?.className).toContain("ease-out-facet");
  });

  it("shows narration as read-only progress", () => {
    render(<NarratorProgress value={42.4} color="var(--tint)" />);
    expect(screen.getByRole("progressbar", { name: "Narration progress" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
