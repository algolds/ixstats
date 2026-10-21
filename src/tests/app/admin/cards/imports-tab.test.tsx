/** The Imports tab: wikis and Commons, or NationStates, as its link names, following back and forward. */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/app/admin/cards/imports/WikiImporter", () => ({
  WikiImporter: () => <p>wiki importer</p>,
}));
jest.mock("~/app/admin/cards/imports/ImportJobs", () => ({
  ImportJobs: () => <p>import jobs</p>,
}));
jest.mock("~/app/admin/cards/imports/ns", () => ({
  NsImports: () => <p>nationstates importer</p>,
}));

import { ImportsTab } from "~/app/admin/cards/imports";

const openAt = (search: string) => window.history.replaceState({}, "", `/admin/cards?${search}`);

describe("ImportsTab", () => {
  it.each([
    ["tab=imports&subtab=nationstates", "nationstates importer"],
    ["tab=imports&subtab=ns", "nationstates importer"],
    ["tab=ns", "nationstates importer"],
    // The old panel's ?tab=import opened its NationStates section.
    ["tab=import", "nationstates importer"],
    ["tab=import&subtab=wiki", "wiki importer"],
    ["tab=lore", "wiki importer"],
    ["tab=imports&subtab=flags", "wiki importer"],
    ["tab=imports", "wiki importer"],
  ])("?%s opens the %s", (search, panel) => {
    openAt(search);
    render(<ImportsTab />);
    expect(screen.getByText(panel)).toBeInTheDocument();
  });

  it("shows the import jobs with the wiki importer", () => {
    openAt("tab=imports");
    render(<ImportsTab />);
    expect(screen.getByText("import jobs")).toBeInTheDocument();
  });

  it("writes the section to the address, and follows back and forward", () => {
    openAt("tab=imports");
    render(<ImportsTab />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "NationStates" }), { button: 0 });
    expect(screen.getByText("nationstates importer")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("subtab")).toBe("nationstates");
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("imports");

    openAt("tab=imports&subtab=wiki");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("wiki importer")).toBeInTheDocument();
  });
});
