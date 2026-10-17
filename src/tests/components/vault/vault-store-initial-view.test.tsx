import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/vault/sections/marketplace/store/StoreCategoryHeader", () => ({
  StoreCategoryHeader: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="active-store-tab">{activeTab}</div>
  ),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    ...Object.fromEntries(
      ["vault", "cardPacks"].map((router) => [
        router,
        new Proxy(
          {},
          {
            get: () => ({
              useQuery: () => ({ data: undefined, isLoading: true, refetch: jest.fn() }),
              useMutation: () => ({ mutate: jest.fn(), isPending: false }),
            }),
          }
        ),
      ])
    ),
  },
}));

import {
  VaultStoreTab,
  resolveStoreView,
} from "~/components/vault/sections/marketplace/VaultStoreTab";

describe("the Vault shop's initial view", () => {
  it("opens on Packs by default", () => {
    render(<VaultStoreTab />);
    expect(screen.getByTestId("active-store-tab").textContent).toBe("packs");
    expect(screen.getByText("Packs from every realm. Each shows its odds.")).toBeInTheDocument();
  });

  it("opens on Packs from an old boosters link", () => {
    render(<VaultStoreTab initialView="boosters" />);
    expect(screen.getByTestId("active-store-tab").textContent).toBe("packs");
  });

  it("opens on My packs when the view param names it", () => {
    render(<VaultStoreTab initialView="my-packs" />);
    expect(screen.getByTestId("active-store-tab").textContent).toBe("my-packs");
  });

  it("ignores a view that is not a sub-tab", () => {
    expect(resolveStoreView("nope")).toBe("packs");
    expect(resolveStoreView(null)).toBe("packs");
    expect(resolveStoreView("upgrades")).toBe("upgrades");
  });

  it("names the pack shop Packs and keeps old links working", () => {
    expect(resolveStoreView(undefined)).toBe("packs");
    expect(resolveStoreView("packs")).toBe("packs");
    expect(resolveStoreView("my-packs")).toBe("my-packs");
    expect(resolveStoreView("boosters")).toBe("packs");
  });
});
