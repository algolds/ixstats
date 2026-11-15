/** The system context menu: one Facet menu for every page, resolved from what was right-clicked. */
import { fireEvent, render, screen } from "@testing-library/react";

const mockOpenCountry = jest.fn();
const mockPush = jest.fn();
jest.mock("~/components/shared/country-actions/CountryActionsProvider", () => ({
  useOpenCountryActions: () => mockOpenCountry,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

import {
  SystemContextMenuProvider,
  useContextArea,
} from "~/components/shared/context-menu/SystemContextMenu";
import { CountryLink } from "~/components/shared/country-actions/CountryLink";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";

beforeEach(() => {
  mockOpenCountry.mockClear();
  mockPush.mockClear();
});

const items = () => screen.queryAllByRole("menuitem").map((item) => item.textContent);

function Area() {
  const area = useContextArea((target) =>
    target.link ? <DropdownMenuItem>Pin this link</DropdownMenuItem> : null
  );
  return (
    <section {...area}>
      <a href="/in-area">In area</a>
      <p>Area text</p>
    </section>
  );
}

const renderApp = () =>
  render(
    <SystemContextMenuProvider>
      <p>Plain text</p>
      <a href="/help/getting-started">Article</a>
      <CountryLink country={{ id: "c1", slug: "alcairet", name: "Alcairet" }}>Alcairet</CountryLink>
      <img alt="Flag" src="/flag.png" />
      <input aria-label="Search" />
      <Area />
      <ContextMenu>
        <ContextMenuTrigger>
          <article>A post</article>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Reply</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SystemContextMenuProvider>
  );

it("shows the page actions on plain page content", () => {
  renderApp();
  fireEvent.contextMenu(screen.getByText("Plain text"));
  expect(items()).toEqual(["Back", "Reload", "Copy page link"]);
});

it("shows the link actions on a link", () => {
  renderApp();
  fireEvent.contextMenu(screen.getByRole("link", { name: "Article" }));
  expect(items()).toEqual(["Open", "Open in new tab", "Copy link"]);
});

it("opens the nation's sheet and its profile from a country link", () => {
  renderApp();
  fireEvent.contextMenu(screen.getByRole("link", { name: "Alcairet" }));
  expect(items()).toEqual(["Open nation", "Open profile", "Open in new tab", "Copy link"]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Open nation" }));
  expect(mockOpenCountry).toHaveBeenCalledWith({ id: "c1", slug: "alcairet", name: "Alcairet" });
  expect(items()).toEqual([]);

  fireEvent.contextMenu(screen.getByRole("link", { name: "Alcairet" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Open profile" }));
  expect(mockPush).toHaveBeenCalledWith("/countries/alcairet");
});

it("shows the image actions on an image", () => {
  renderApp();
  fireEvent.contextMenu(screen.getByAltText("Flag"));
  expect(items()).toEqual(["Open image", "Copy image address"]);
});

it("puts an area's own items above the defaults", () => {
  renderApp();
  fireEvent.contextMenu(screen.getByRole("link", { name: "In area" }));
  expect(items()).toEqual(["Pin this link", "Open", "Open in new tab", "Copy link"]);
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  fireEvent.contextMenu(screen.getByText("Area text"));
  expect(items()).toEqual(["Back", "Reload", "Copy page link"]);
});

it("leaves text fields and Shift+right-click to the browser", () => {
  renderApp();
  const field = fireEvent.contextMenu(screen.getByLabelText("Search"));
  const shifted = fireEvent.contextMenu(screen.getByText("Plain text"), {
    shiftKey: true,
    button: 2,
  });
  // `fireEvent` returns false when a handler prevented the default.
  expect([field, shifted]).toEqual([true, true]);
  expect(items()).toEqual([]);
});

it("lets a feature's own context menu win", () => {
  renderApp();
  fireEvent.contextMenu(screen.getByText("A post"));
  expect(items()).toEqual(["Reply"]);
});
