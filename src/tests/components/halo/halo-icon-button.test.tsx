import { render, screen } from "@testing-library/react";
import { Bell } from "iconoir-react";
import { HaloIconButton, formatBadgeCount } from "~/components/halo/views/compact/HaloIconButton";

describe("HaloIconButton", () => {
  it.each([
    [1, "1"],
    [9, "9"],
    [10, "10"],
    [99, "99"],
    [100, "99+"],
    [1200, "99+"],
  ])("formats %p as %p", (n, s) => expect(formatBadgeCount(n)).toBe(s));

  it("names the count and fits the badge to it", () => {
    render(<HaloIconButton label="Notifications" icon={Bell} onClick={() => {}} badge={12} />);
    const button = screen.getByRole("button", { name: "Notifications, 12 unread" });
    expect(button.className).toContain("pointer-coarse:w-11");
    const badge = button.querySelector('[data-slot="halo-badge"]');
    expect(badge?.textContent).toBe("12");
    expect(badge?.className).toContain("min-w-4");
  });

  it("hides the badge at zero", () => {
    render(<HaloIconButton label="Notifications" icon={Bell} onClick={() => {}} badge={0} />);
    expect(
      screen
        .getByRole("button", { name: "Notifications" })
        .querySelector('[data-slot="halo-badge"]')
    ).toBeNull();
  });

  it("never scales or rotates the icon", () => {
    const { container } = render(
      <HaloIconButton label="Settings" icon={Bell} onClick={() => {}} />
    );
    expect(container.innerHTML).not.toMatch(/hover:(scale|rotate)-/);
  });
});
