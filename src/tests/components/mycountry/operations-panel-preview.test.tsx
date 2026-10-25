/** P2-11: the free Defense preview hides "Deploy forces", like every other write control there. */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MyCountryEditModeProvider } from "~/context/MyCountryEditModeContext";

jest.mock("~/trpc/react", () => ({ api: { useUtils: () => ({}) } }));
jest.mock("~/components/mycountry/domains/defense/operations/DeploymentWizard", () => ({
  DeploymentWizard: () => <button type="button">Deploy forces</button>,
}));
jest.mock("~/components/mycountry/domains/defense/operations/ActiveOperations", () => ({
  ActiveOperations: () => null,
}));
jest.mock("~/components/mycountry/domains/defense/operations/PvPConflictPanel", () => ({
  PvPConflictPanel: () => null,
}));

import { OperationsPanel } from "~/components/mycountry/domains/defense/OperationsPanel";

const renderPanel = (canEdit: boolean) =>
  render(
    <MyCountryEditModeProvider canEdit={canEdit} reason={canEdit ? null : "premium"}>
      <OperationsPanel countryId="c1" />
    </MyCountryEditModeProvider>
  );

it("hides Deploy forces in the read-only preview", () => {
  renderPanel(false);
  expect(screen.queryByRole("button", { name: "Deploy forces" })).toBeNull();
});

it("shows Deploy forces to an editor", () => {
  renderPanel(true);
  expect(screen.getByRole("button", { name: "Deploy forces" })).toBeTruthy();
});
