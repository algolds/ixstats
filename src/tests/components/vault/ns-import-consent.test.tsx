/** Cards refresh §3 UX details: NationStates deck import Flow step 1 and confirm consent. */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));

jest.mock("motion/react", () => {
  const still = (Tag: "div" | "h2" | "p") =>
    function Still({ children }: { children?: React.ReactNode }) {
      return <Tag>{children}</Tag>;
    };
  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: { div: still("div"), h2: still("h2"), p: still("p") },
  };
});

jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value}</span>,
}));

import { ImportNationStep } from "~/components/vault/sections/import/ImportNationStep";
import { ImportConfirmStep } from "~/components/vault/sections/import/ImportConfirmStep";
import { ImportStepIndicator } from "~/components/vault/sections/import/ImportStepIndicator";
import { VaultImportSection } from "~/components/vault/sections/VaultImportSection";

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

jest.mock("~/hooks/useCardsRefresh", () => ({
  useCardsRefresh: () => jest.fn(),
}));

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ nsImport: { getMyNSCards: { invalidate: jest.fn() } } }),
    nsImport: {
      requestVerification: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      checkVerification: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
      importDeck: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));

describe("NS import flow steps", () => {
  it("renders Step 1 with the compact NationStates badge and immediate nation-name input without a Get started gate", () => {
    const onRequestVerification = jest.fn();
    function Wrapper() {
      const [name, setName] = React.useState("");
      return (
        <ImportNationStep
          nationName={name}
          setNationName={setName}
          onRequestVerification={onRequestVerification}
          isPending={false}
        />
      );
    }

    render(<Wrapper />);
    expect(document.querySelector("[data-slot='ns-compact-badge']")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /get started/i })).not.toBeInTheDocument();

    const input = screen.getByLabelText("NationStates nation name");
    fireEvent.change(input, { target: { value: "Testlandia" } });
    fireEvent.click(screen.getByRole("button", { name: /start verification/i }));
    expect(onRequestVerification).toHaveBeenCalledWith("Testlandia");
  });

  it("renders ImportStepIndicator on Chrome with facet-gold active/completed step pills", () => {
    render(<ImportStepIndicator currentStep="verify" />);
    const nav = screen.getByRole("navigation", { name: "Import steps" });
    expect(nav).toHaveClass("facet-chrome");
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument();
    const goldPills = nav.querySelectorAll(".facet-gold");
    expect(goldPills.length).toBe(2);
  });

  it("imports only once the owner allows IxStates to show the nation's flag and cards", () => {
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

  it("renders VaultImportSection as a centered Flow setup assistant with StepIndicator inside the input Card and no back link", () => {
    globalThis.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
    render(<VaultImportSection />);

    expect(screen.getByRole("heading", { level: 1, name: "Import deck" })).toBeVisible();
    expect(
      screen.getByText("Transfer NationStates trading cards into your Vault collection.")
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /vault/i })).not.toBeInTheDocument();

    const inputPane = document.querySelector("[data-content='input']") as HTMLElement;
    expect(inputPane).toBeInTheDocument();
    expect(inputPane.querySelector("[data-slot='step-indicator']")).toBeInTheDocument();
  });
});
