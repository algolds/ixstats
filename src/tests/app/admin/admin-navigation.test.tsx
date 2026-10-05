import React from "react";
import { render, screen, act } from "@testing-library/react";

let mockPathname = "/admin/polls";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));
jest.mock("~/hooks/useLiveNotifications", () => ({
  useNotificationBadge: () => ({ unreadCount: 0 }),
}));

// eslint-disable-next-line import/first
import {
  AdminNavigationProvider,
  useAdminNavigation,
} from "~/app/admin/_components/AdminNavigationContext";

const seen: string[] = [];

function Probe() {
  const { activeSection } = useAdminNavigation();
  seen.push(activeSection);
  return <p data-testid="section">{activeSection}</p>;
}

function Tree() {
  return (
    <AdminNavigationProvider>
      <Probe />
    </AdminNavigationProvider>
  );
}

beforeEach(() => {
  seen.length = 0;
  mockPathname = "/admin/polls";
});

describe("AdminNavigationProvider", () => {
  it("renders the section matching the pathname on the first render", () => {
    render(<Tree />);
    expect(seen).toEqual(["polls"]);
  });

  it("never renders the previous section after the pathname changes", () => {
    const { rerender } = render(<Tree />);
    seen.length = 0;
    mockPathname = "/admin/bot";
    rerender(<Tree />);
    expect(seen.every((s) => s === "bot")).toBe(true);
    expect(screen.getByTestId("section")).toHaveTextContent("bot");
  });

  it("maps /admin to the dashboard", () => {
    mockPathname = "/admin";
    render(<Tree />);
    expect(screen.getByTestId("section")).toHaveTextContent("dashboard");
  });

  it("titles the document per section", () => {
    mockPathname = "/admin/national-issues";
    render(<Tree />);
    expect(document.title).toBe("Admin - National Issues - IxStats");
  });

  it("titles the dashboard", () => {
    mockPathname = "/admin";
    render(<Tree />);
    expect(document.title).toBe("Admin Dashboard - IxStats");
  });

  it("switches section in place when a caller navigates", () => {
    const pushState = jest.spyOn(window.history, "pushState");
    const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    let navigate: (section: string) => void = () => undefined;
    function Grab() {
      navigate = useAdminNavigation().onNavigate;
      return null;
    }
    render(
      <AdminNavigationProvider>
        <Grab />
      </AdminNavigationProvider>
    );
    act(() => navigate("bot"));
    expect(pushState).toHaveBeenCalledWith(null, "", expect.stringMatching(/\/admin\/bot$/));
    expect(scrollTo).toHaveBeenCalled();
    pushState.mockRestore();
    scrollTo.mockRestore();
  });
});
