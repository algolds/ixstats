/** FrontPageHero map hover chip: only looks up flags for claimed nations and treats placeholder results as no flag. */
import { act, render, screen } from "@testing-library/react";
import type { EmbedPoliticalFeature } from "~/components/maps/widgets/CoordinatesMapEmbed";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

let hoverCallback: ((feature: EmbedPoliticalFeature | null) => void) | undefined;
const mockUseFlag = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("~/components/maps/widgets/CoordinatesMapEmbed", () => ({
  CoordinatesMapEmbed: ({
    onCountryHover,
  }: {
    onCountryHover?: (feature: EmbedPoliticalFeature | null) => void;
  }) => {
    hoverCallback = onCountryHover;
    return <div data-testid="coordinates-map" />;
  },
}));
jest.mock("~/hooks/useUnifiedFlags", () => ({
  useFlag: (countryName?: string, realm?: string) => mockUseFlag(countryName, realm),
}));

import { FrontPageHero, type FeaturedRealmItem } from "~/app/_components/front-page/FrontPageHero";

beforeAll(stubResizeObserver);

const realm: FeaturedRealmItem = {
  id: "r1",
  slug: "eurth",
  name: "Eurth",
  description: "Featured realm",
  thumbnail: null,
  foundedAt: null,
  nationCount: 2,
  openNationCount: 1,
} as unknown as FeaturedRealmItem;

beforeEach(() => {
  jest.useFakeTimers();
  hoverCallback = undefined;
  mockUseFlag.mockReset();
  mockUseFlag.mockReturnValue({
    flagUrl: "/images/flags/placeholder.svg",
    isLoading: false,
    error: false,
    isLocal: false,
    isPlaceholder: true,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("FrontPageHero flag lookup on map hover", () => {
  it("skips useFlag lookup for unclaimed features and shows the fallback icon", () => {
    render(<FrontPageHero realm={realm} nations={[]} facts={undefined} />);
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByTestId("coordinates-map")).toBeInTheDocument();

    mockUseFlag.mockClear();
    act(() => {
      hoverCallback?.({
        featureId: "wild-1",
        displayName: "Unclaimed Wastes",
        countryId: null,
        fillColor: "#ccc",
        centroidLng: 0,
        centroidLat: 0,
      });
    });

    expect(mockUseFlag).toHaveBeenLastCalledWith(undefined, "eurth");
    const label = screen.getByText("Unclaimed Wastes");
    expect(label.parentElement?.querySelector("img")).toBeNull();
    expect(label.parentElement?.querySelector("svg")).not.toBeNull();
  });

  it("queries useFlag for a claimed nation without flagUrl and treats a placeholder result as no flag", () => {
    render(
      <FrontPageHero
        realm={realm}
        nations={[
          {
            id: "c1",
            name: "Urcea",
            slug: "urcea",
            flagUrl: null,
            currentTotalGdp: 500_000_000_000,
            economicTier: "Developed",
          } as never,
        ]}
        facts={undefined}
      />
    );
    act(() => {
      jest.advanceTimersByTime(250);
    });

    mockUseFlag.mockClear();
    act(() => {
      hoverCallback?.({
        featureId: "urcea",
        displayName: "Urcea",
        countryId: "c1",
        fillColor: "#06b6d4",
        centroidLng: 10,
        centroidLat: 20,
      });
    });

    expect(mockUseFlag).toHaveBeenLastCalledWith("Urcea", "eurth");
    const chipLabel = screen.getAllByText("Urcea")[0]!;
    expect(chipLabel.parentElement?.querySelector("img")).toBeNull();
    expect(chipLabel.parentElement?.querySelector("svg")).not.toBeNull();
  });
});
