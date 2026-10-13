/**
 * The World Studio route is full screen: the admin layout leaves it (and the other map tools) bare, exactly and not by
 * prefix, and the page carries the Maps tint and the `?fit=` realm to the Studio.
 */
import { render, screen } from "@testing-library/react";

let mockPathname = "/admin/maps/studio";
let mockSearch = "";
let mockRole = "admin";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock(
  "next/dynamic",
  () => () => jest.requireMock("~/components/maps/studio/WorldStudio").default
);
jest.mock("~/components/maps/studio/WorldStudio", () => ({
  __esModule: true,
  default: ({ fit }: { fit: string | null }) => <p data-testid="studio">{`studio fit=${fit}`}</p>,
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "u", publicMetadata: { role: mockRole } }, isLoaded: true }),
  useAuth: () => ({ signOut: jest.fn() }),
  SignInButton: () => null,
}));
jest.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({ user: { role: { name: mockRole } }, isLoading: false }),
}));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/components/providers/PortalTintSync", () => ({ PortalTintSync: () => null }));
jest.mock("~/app/admin/_components/SystemStatusWidget", () => ({
  SystemStatusStrip: () => <div data-testid="status-strip" />,
}));
jest.mock("~/app/admin/_components/AdminNavigationContext", () => ({
  AdminNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AdminLayout from "~/app/admin/layout";
import WorldStudioPage from "~/app/admin/maps/studio/page";

describe("the admin layout", () => {
  const renderAt = (pathname: string) => {
    mockPathname = pathname;
    return render(
      <AdminLayout>
        <p>child</p>
      </AdminLayout>
    );
  };

  it.each(["/admin/maps/studio", "/admin/maps/editor", "/admin/maps/style-editor"])(
    "leaves %s bare, without the status strip around it",
    (pathname) => {
      renderAt(pathname);
      expect(screen.getByText("child")).toBeInTheDocument();
      expect(screen.queryByTestId("status-strip")).not.toBeInTheDocument();
    }
  );

  it.each(["/admin/maps", "/admin/maps/studio/extra", "/admin/maps/realms/ixnay", "/admin/polls"])(
    "keeps the admin container around %s",
    (pathname) => {
      renderAt(pathname);
      expect(screen.getByTestId("status-strip")).toBeInTheDocument();
    }
  );
});

describe("the admin guard", () => {
  afterEach(() => {
    mockRole = "admin";
  });

  it("still runs for the bare Studio route: a member gets Access denied, not the Studio", () => {
    mockRole = "member";
    mockPathname = "/admin/maps/studio";
    render(
      <AdminLayout>
        <p>child</p>
      </AdminLayout>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });
});

describe("the Studio page", () => {
  it("fills the screen above the shell, in the Maps tint", () => {
    mockSearch = "";
    const { container } = render(<WorldStudioPage />);
    const shell = container.firstElementChild!;
    expect(shell).toHaveAttribute("data-app", "maps");
    expect(shell).toHaveClass("bg-background", "absolute", "inset-0", "z-40");
  });

  it("opens fitted to the realm of ?fit=", () => {
    mockSearch = "fit=eurth";
    render(<WorldStudioPage />);
    expect(screen.getByTestId("studio")).toHaveTextContent("studio fit=eurth");
  });

  it("opens on a preset without it", () => {
    mockSearch = "";
    render(<WorldStudioPage />);
    expect(screen.getByTestId("studio")).toHaveTextContent("studio fit=null");
  });
});
