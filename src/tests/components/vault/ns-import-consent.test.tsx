/** Cards refresh §3 UX details: the NS import consent lives in /vault/import's confirm step. */
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { ImportConfirmStep } from "~/components/vault/sections/import/ImportConfirmStep";

jest.mock("motion/react", () => ({
  motion: { div: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
}));
jest.mock("~/components/cards/display/CardHolographicCover", () => ({
  CardHolographicCover: () => null,
}));
jest.mock("~/components/ui/number-flow", () => ({ NumberFlowDisplay: () => null }));

describe("NS import confirm step", () => {
  it("imports only once the owner allows IxStats to show the nation's flag and cards", () => {
    const onConfirmImport = jest.fn();
    render(
      <ImportConfirmStep nationName="Kiro" onBack={jest.fn()} onConfirmImport={onConfirmImport} />
    );
    const importButton = screen.getByRole("button", { name: /import deck/i });
    expect(importButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);
    expect(onConfirmImport).toHaveBeenCalledTimes(1);
  });
});
