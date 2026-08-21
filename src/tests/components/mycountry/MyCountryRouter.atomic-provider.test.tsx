import React from "react";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { MyCountryRouter } from "~/components/mycountry/shell/MyCountryRouter";

const mockGetProfile = jest.fn();
const mockGetByIdWithEconomicData = jest.fn();
const mockGetCurrentIxTime = jest.fn();
const mockGetActivityRingsData = jest.fn();

const mockUnifiedAtomicGetAll = jest.fn(() => {
  throw new Error("api.unifiedAtomic.getAll should not be called in MyCountryRouter shell");
});
const mockUnifiedAtomicDetectSynergies = jest.fn(() => {
  throw new Error("api.unifiedAtomic.detectSynergies should not be called in MyCountryRouter shell");
});
const mockUnifiedAtomicCalculateCombined = jest.fn(() => {
  throw new Error("api.unifiedAtomic.calculateCombinedEffectiveness should not be called in MyCountryRouter shell");
});

jest.mock("~/trpc/react", () => ({
  api: {
    users: {
      getProfile: {
        useQuery: (...args: any[]) => {
          mockGetProfile(...args);
          return {
            data: {
              id: "user-1",
              countryId: "country-123",
              country: {
                id: "country-123",
                name: "Testland",
                slug: "testland",
              },
            },
            isLoading: false,
            error: null,
          };
        },
      },
    },
    countries: {
      getByIdWithEconomicData: {
        useQuery: (...args: any[]) => {
          mockGetByIdWithEconomicData(...args);
          return {
            data: {
              id: "country-123",
              name: "Testland",
              slug: "testland",
              governmentType: "DEMOCRACY",
              population: 1000000,
              gdp: 50000000000,
            },
            isLoading: false,
            error: null,
          };
        },
      },
      getActivityRingsData: {
        useQuery: (...args: any[]) => {
          mockGetActivityRingsData(...args);
          return {
            data: { rings: [] },
            isLoading: false,
          };
        },
      },
    },
    system: {
      getCurrentIxTime: {
        useQuery: (...args: any[]) => {
          mockGetCurrentIxTime(...args);
          return {
            data: { currentIxTime: 1000 },
            isLoading: false,
          };
        },
      },
    },
    unifiedAtomic: {
      getAll: {
        useQuery: mockUnifiedAtomicGetAll,
      },
      detectSynergies: {
        useQuery: mockUnifiedAtomicDetectSynergies,
      },
      calculateCombinedEffectiveness: {
        useQuery: mockUnifiedAtomicCalculateCombined,
      },
    },
    intelligence: {
      getAlerts: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
    },
  },
}));

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({
    user: { id: "user-1", name: "Test Leader" },
    isSignedIn: true,
    isLoaded: true,
  }),
}));

jest.mock("~/context/DevCountryViewContext", () => ({
  useDevCountryView: () => ({
    viewCountryId: null,
    isViewingOtherCountry: false,
  }),
}));

jest.mock("~/context/DemoModeContext", () => ({
  useDemoMode: () => ({
    isDemoActive: false,
    demoCountryId: null,
  }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/mycountry",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock("~/hooks/useMyCountryCompliance", () => ({
  useMyCountryCompliance: () => ({
    isCompliant: true,
    showModal: false,
    complianceSections: [],
    handleReview: jest.fn(),
    handleRemindLater: jest.fn(),
  }),
}));

jest.mock("~/hooks/useNationalIssuesToast", () => ({
  useNationalIssuesToast: jest.fn(),
}));

jest.mock("~/components/mycountry/shell/CommandSurface", () => ({
  CommandSurface: ({ country }: { country: any }) => (
    <div data-testid="mock-command-surface">
      Command Surface Active for {country?.name || "Unknown"}
    </div>
  ),
}));

describe("Plan 165: MyCountryRouter without AtomicStateProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mounts real CountryDataProvider and renders CommandSurface", () => {
    render(<MyCountryRouter />);

    expect(screen.getByTestId("mock-command-surface")).toBeInTheDocument();
    expect(screen.getByText(/Command Surface Active for Testland/)).toBeInTheDocument();
  });

  it("subscribes to CountryDataProvider queries without duplicate calls", () => {
    render(<MyCountryRouter />);

    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    expect(mockGetByIdWithEconomicData).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentIxTime).toHaveBeenCalledTimes(1);
    expect(mockGetActivityRingsData).toHaveBeenCalledTimes(1);
  });

  it("does not invoke any unifiedAtomic query hooks on shell mount", () => {
    render(<MyCountryRouter />);

    expect(mockUnifiedAtomicGetAll).not.toHaveBeenCalled();
    expect(mockUnifiedAtomicDetectSynergies).not.toHaveBeenCalled();
    expect(mockUnifiedAtomicCalculateCombined).not.toHaveBeenCalled();
  });

  it("statically verifies AtomicStateProvider is purged from router and filesystem", () => {
    const routerPath = path.resolve(
      __dirname,
      "../../../components/mycountry/shell/MyCountryRouter.tsx"
    );
    const routerSource = fs.readFileSync(routerPath, "utf-8");

    expect(routerSource).not.toContain("AtomicStateProvider");
    expect(routerSource).not.toContain("AtomicStateProviderWrapper");

    const providerPath = path.resolve(
      __dirname,
      "../../../components/ui/atomic/AtomicStateProvider.tsx"
    );
    expect(fs.existsSync(providerPath)).toBe(false);
  });
});
