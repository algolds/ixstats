/** The Imports tab opens the subtab its link names: the URL is the only source of the subtab. */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  ...jest.requireActual<typeof import("next/navigation")>("next/navigation"),
  useSearchParams: jest.fn(),
}));
jest.mock("~/app/admin/cards/LoreCardBatchAdmin", () => ({
  LoreCardBatchAdmin: () => <p>wiki importer</p>,
}));
jest.mock("~/app/admin/cards/NSImportSuiteAdmin", () => ({
  NSImportSuiteAdmin: () => <p>nationstates importer</p>,
}));
jest.mock("~/app/admin/cards/CommonsFlagImporterAdmin", () => ({
  CommonsFlagImporterAdmin: () => <p>commons importer</p>,
}));

import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { CardImportStudio } from "~/app/admin/cards/CardImportStudio";

describe("CardImportStudio", () => {
  it.each([
    ["tab=imports&subtab=ns", "nationstates importer"],
    ["tab=imports&subtab=flags", "commons importer"],
    ["tab=imports", "wiki importer"],
  ])("?%s opens the %s", (search, panel) => {
    jest.mocked(useSearchParams).mockReturnValue(new ReadonlyURLSearchParams(search));
    render(<CardImportStudio />);
    expect(screen.getByText(panel)).toBeInTheDocument();
  });
});
