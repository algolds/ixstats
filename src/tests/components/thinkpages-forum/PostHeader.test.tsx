import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/thinkpages/PersonaAuthorCard", () => ({
  PersonaAuthorCard: ({ username, children }: { username: string; children: React.ReactNode }) => (
    <span data-testid="persona-card" data-username={username}>
      {children}
    </span>
  ),
}));

import { PostHeader } from "~/components/thinkpages-forum/thread/PostHeader";

type Props = React.ComponentProps<typeof PostHeader>;

const base: Props = {
  name: "Fiannria",
  handle: "fiannria",
  avatarUrl: null,
  flagUrl: null,
  role: null,
  createdAt: new Date("2026-03-12T18:40:00Z"),
  editedAt: null,
  number: 4,
  postId: "p4",
  imported: false,
};

const show = (over: Partial<Props> = {}) => render(<PostHeader {...base} {...over} />);

describe("PostHeader", () => {
  it.each([
    ["staff", "Staff"],
    ["officer", "Officer"],
    ["starter", "Thread starter"],
  ] as const)("shows the %s role as exactly one pill reading %s", (role, text) => {
    show({ role });
    expect(screen.getByText(text)).toBeInTheDocument();
    const pills = ["Staff", "Officer", "Thread starter"].filter((label) => screen.queryByText(label));
    expect(pills).toEqual([text]);
  });

  it("shows no role pill without a role", () => {
    show();
    for (const label of ["Staff", "Officer", "Thread starter"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("links #N to the post's permalink", () => {
    show();
    const link = screen.getByRole("link", { name: /#4/ });
    expect(link).toHaveAttribute("href", "/thinkpages/post/p4");
  });

  it("shows the flag at 18 by 12 pixels, and none without one", () => {
    const { container, rerender } = show({ flagUrl: "/flags/fi.png" });
    const flag = container.querySelector("img[src='/flags/fi.png']");
    expect(flag).toHaveAttribute("width", "18");
    expect(flag).toHaveAttribute("height", "12");
    expect(flag).toHaveAttribute("alt", "");
    rerender(<PostHeader {...base} flagUrl={null} />);
    expect(container.querySelector("img[width='18']")).toBeNull();
  });

  it("falls back to initials when the author has no avatar", () => {
    show({ name: "River Compacts", avatarUrl: null });
    expect(screen.getByText("RC")).toBeInTheDocument();
  });

  it("wraps a persona's name in the persona card, and a member's not", () => {
    const { unmount } = show({ name: "Aria Vance", handle: "aria", personaUsername: "aria" });
    expect(screen.getByTestId("persona-card")).toHaveAttribute("data-username", "aria");
    expect(screen.getByTestId("persona-card")).toHaveTextContent("Aria Vance");
    unmount();
    show();
    expect(screen.queryByTestId("persona-card")).toBeNull();
  });

  it("badges an imported post that has no account as Old forum, and a member's not", () => {
    const { unmount } = show({ name: "Kir", handle: null, imported: true });
    expect(screen.getByText("Old forum")).toBeInTheDocument();
    unmount();
    show();
    expect(screen.queryByText("Old forum")).toBeNull();
  });

  it("shows the handle and the full date, plus edited when it was", () => {
    const { container, rerender } = show();
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-03-12T18:40:00.000Z");
    expect(time?.textContent).toMatch(/2026/);
    expect(screen.getByText(/@fiannria/)).toBeInTheDocument();
    expect(screen.queryByText(/edited/)).toBeNull();
    rerender(<PostHeader {...base} editedAt={new Date("2026-03-13T09:02:00Z")} />);
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it("badges a hidden post", () => {
    show({ hidden: true });
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });
});
