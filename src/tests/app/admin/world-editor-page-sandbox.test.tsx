/** The admin world editor page opens in the sandbox for ?sandbox=1, on the realm ?realm= names. */
import { render, screen } from "@testing-library/react";

const searchParams = { current: new URLSearchParams() };
jest.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.current,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("next/dynamic", () => () => (props: { isWorldMode?: boolean; sandbox?: boolean }) => (
  <div
    data-testid="overlay"
    data-world={String(props.isWorldMode)}
    data-sandbox={String(props.sandbox)}
  />
));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/maps/core/MapRealmContext", () => ({
  MapRealmProvider: ({ children, value }: { children: React.ReactNode; value?: string }) => (
    <div data-testid="realm" data-realm={value ?? ""}>
      {children}
    </div>
  ),
}));
jest.mock("~/components/maps/editor/utils/editor-overlay-helpers", () => ({
  EditorLoadingScreen: () => null,
}));

import WorldEditorPage from "~/app/admin/maps/editor/page";

const open = (query: string) => {
  searchParams.current = new URLSearchParams(query);
  render(<WorldEditorPage />);
  return screen.getByTestId("overlay");
};

describe("the admin world editor page", () => {
  it("opens the world editor in the sandbox for ?sandbox=1", () => {
    const overlay = open("sandbox=1");
    expect(overlay).toHaveAttribute("data-world", "true");
    expect(overlay).toHaveAttribute("data-sandbox", "true");
  });

  it("opens the plain world editor otherwise", () => {
    expect(open("")).toHaveAttribute("data-sandbox", "false");
  });

  it("keeps the realm the address names", () => {
    open("realm=eurth&sandbox=1");
    expect(screen.getByTestId("realm")).toHaveAttribute("data-realm", "eurth");
  });
});
