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

  it("shows narration as read-only progress", () => {
    render(<NarratorProgress value={42.4} color="var(--tint)" />);
    expect(screen.getByRole("progressbar", { name: "Narration progress" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
