/** Every country link opens the nation's actions sheet on a plain click and stays a real link otherwise. */
import { fireEvent, render, screen } from "@testing-library/react";

const mockOpen = jest.fn();
jest.mock("~/components/shared/country-actions/CountryActionsProvider", () => ({
  useOpenCountryActions: () => mockOpen,
}));

import { CountryLink } from "~/components/shared/country-actions/CountryLink";

beforeEach(() => mockOpen.mockClear());

const renderLink = () =>
  render(
    <CountryLink country={{ id: "c1", slug: "alcairet", name: "Alcairet" }}>Alcairet</CountryLink>
  );

it("opens the sheet on a plain click, keeping the profile as its href", () => {
  renderLink();
  const link = screen.getByRole("link", { name: "Alcairet" });
  expect(link).toHaveAttribute("href", "/countries/alcairet");
  fireEvent.click(link);
  expect(mockOpen).toHaveBeenCalledWith({ id: "c1", slug: "alcairet", name: "Alcairet" });
});

it("leaves Cmd-click and middle click to the link", () => {
  renderLink();
  const link = screen.getByRole("link", { name: "Alcairet" });
  fireEvent.click(link, { metaKey: true });
  fireEvent.click(link, { button: 1 });
  expect(mockOpen).not.toHaveBeenCalled();
});
