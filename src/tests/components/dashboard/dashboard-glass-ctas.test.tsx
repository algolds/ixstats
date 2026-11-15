/**
 * Dashboard neutral Facet Lens glass CTAs (`Button variant="glass"` + `@utility facet-glass-cta`):
 * verifies concentric control radii (`rounded-control-sm` / `rounded-control`), colour-only press
 * (no scale or translate), neutral `text-label` WCAG AAA contrast in light and dark themes, and
 * zero rainbow `[data-app]` tint overrides across DashboardHero, YourRealmPanel, DailyBlurbCard,
 * GlassCanvasComposer and ComposerActionBar.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "~/components/ui/button";
import { TooltipProvider } from "~/components/ui/tooltip";
import { DashboardHero } from "~/components/dashboard/hero/DashboardHero";
import { YourRealmPanel } from "~/components/dashboard/sections/YourRealmPanel";
import { DailyBlurbCard } from "~/components/dashboard/sections/BlurbSection";
import { GlassCanvasComposer } from "~/components/thinkpages/GlassCanvasComposer";
import { ComposerActionBar } from "~/components/thinkpages/composer/ComposerActionBar";
import { BACKGROUND_ROLES, COLOR_ROLES, type Appearance } from "~/lib/design/tokens";

jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user-1" }, isSignedIn: true }),
}));

jest.mock("~/hooks/useActiveCosmetics", () => ({
  useActiveCosmetics: () => ({
    avatarGlow: { enabled: false, color: "", intensity: "subtle" },
    chatBadge: { enabled: false, icon: "crown", color: "" },
    neonFrame: { enabled: false, color: "", style: "solid" },
  }),
}));

jest.mock("~/hooks/useNationClock", () => ({
  useClockNow: () => new Date("2026-11-14T12:00:00Z"),
}));

jest.mock("~/hooks/useRealmClock", () => ({
  useRealmClock: () => ({
    epochRealTime: 0,
    epochSimTime: 0,
    multiplier: 1,
    calendar: "gregorian",
  }),
}));

jest.mock("~/lib/realms/nation-time", () => ({
  formatNationDateLine: () => "14 Nov 2026",
}));

jest.mock("~/components/shared/country-hero/CountryHeroCard", () => ({
  CountryHeroCard: ({ action }: { action: React.ReactNode }) => (
    <div data-testid="hero-card">{action}</div>
  ),
}));

jest.mock("~/components/realms/RealmMapFace", () => ({
  RealmMapFace: () => <div data-testid="realm-map-face" />,
}));

jest.mock("~/components/cards/face/RealmCrest", () => ({
  RealmCrest: () => <div data-testid="realm-crest" />,
}));

jest.mock("~/components/thinkpages/GifPicker", () => ({
  GifPicker: React.forwardRef<HTMLButtonElement>(function GifPicker(_props, ref) {
    return <button ref={ref} type="button" aria-label="Insert GIF" />;
  }),
}));

jest.mock("~/components/thinkpages/GlassPlateEditor", () => ({
  GlassPlateEditor: () => <div data-testid="plate-editor" />,
}));

jest.mock("~/components/thinkpages/LiveDataCard", () => ({
  LiveDataCard: () => <div data-testid="live-data-card" />,
}));

jest.mock("~/components/thinkpages/composer/useGlassCanvasComposer", () => ({
  useGlassCanvasComposer: () => ({
    notify: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
    isRegularUser: false,
    editorRef: { current: null },
    composerRef: { current: null },
    content: "",
    setContent: jest.fn(),
    plainText: "",
    setPlainText: jest.fn(),
    selectedVisualizations: [],
    showAccountManager: false,
    setShowAccountManager: jest.fn(),
    selectedImages: [],
    showMediaModal: false,
    setShowMediaModal: jest.fn(),
    setIsEditorFocused: jest.fn(),
    pollDraft: null,
    setPollDraft: jest.fn(),
    showPollModal: false,
    setShowPollModal: jest.fn(),
    resolvedPlaceholder: "Write a post",
    accountAvatarUrl: undefined,
    getAccountAvatar: () => undefined,
    removeVisualization: jest.fn(),
    handleImageSelect: jest.fn(),
    removeImage: jest.fn(),
    showContentWarning: false,
    setShowContentWarning: jest.fn(),
    contentWarning: "",
    setContentWarning: jest.fn(),
    showActionBar: true,
    showVisualizationPanel: false,
    setShowVisualizationPanel: jest.fn(),
    isGeneratingVisualization: false,
    handleInsertGif: jest.fn(),
    postToDiscord: false,
    setPostToDiscord: jest.fn(),
    handleSubmit: jest.fn(),
    createPostMutation: { isPending: false },
  }),
}));

jest.mock("~/components/thinkpages/composer/usePostAsYourself", () => ({
  usePostAsYourself: () => ({ postAsYourself: jest.fn(), isPending: false }),
  isPersonalAccount: () => false,
}));

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      blurbs: {
        getMyResponse: { invalidate: jest.fn() },
        getResponsesForPrompt: { invalidate: jest.fn() },
        getDailyPrompt: { invalidate: jest.fn() },
        getActivePrompts: { invalidate: jest.fn() },
        getBlurbCount: { invalidate: jest.fn() },
      },
    }),
    users: {
      getProfile: { useQuery: () => ({ data: { countryId: "c-1" } }) },
    },
    countries: {
      getByIdAtTime: {
        useQuery: () => ({
          data: {
            id: "c-1",
            country: "Caphiria",
            newStats: {
              continent: "Aurelia",
              governmentType: "Republic",
              slug: "caphiria",
              currentGdpPerCapita: 42000,
              currentPopulation: 18_000_000,
              currentTotalGdp: 756_000_000_000,
            },
          },
        }),
      },
    },
    realms: {
      myNations: {
        useQuery: () => ({
          data: { realms: [{ id: "realm-1", slug: "rose-sea", name: "Rose Sea" }] },
        }),
      },
    },
    thinkpagesForum: {
      realmPanel: {
        useQuery: () => ({
          data: {
            realm: {
              id: "realm-1",
              slug: "rose-sea",
              name: "Rose Sea",
              bannerUrl: null,
              emblemUrl: null,
              thumbnail: null,
            },
            messages: [],
          },
        }),
      },
      realmBoardPreview: { useQuery: () => ({ data: undefined, isLoading: false }) },
      navCounts: { useQuery: () => ({ data: { realmBoardNew: 2 } }) },
    },
    blurbs: {
      getDailyPrompt: {
        useQuery: () => ({
          data: {
            id: "prompt-1",
            slug: "harbor-customs",
            title: "Harbor customs",
            question: "What greets a merchant ship arriving at dawn?",
            _count: { responses: 4 },
          },
          isLoading: false,
        }),
      },
      getMyResponse: {
        useQuery: () => ({ data: null, isPending: false }),
      },
      getResponsesForPrompt: {
        useInfiniteQuery: () => ({
          data: { pages: [{ responses: [], nextCursor: undefined }] },
          fetchNextPage: jest.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
          isLoading: false,
        }),
      },
      submitResponse: {
        useMutation: () => ({ mutate: jest.fn(), isPending: false, error: null }),
      },
    },
  },
}));

type Rgba = [number, number, number, number];

function parseHex(hex: string): Rgba {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
}

function parseRgba(value: string): Rgba {
  if (value.startsWith("#")) return parseHex(value);
  const nums = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 1];
}

function mixSrgb(a: Rgba, weightA: number, b: Rgba, weightB: number): Rgba {
  const p1 = weightA / 100;
  const p2 = weightB / 100;
  const alpha = a[3] * p1 + b[3] * p2;
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    (a[0] * a[3] * p1 + b[0] * b[3] * p2) / alpha,
    (a[1] * a[3] * p1 + b[1] * b[3] * p2) / alpha,
    (a[2] * a[3] * p1 + b[2] * b[3] * p2) / alpha,
    alpha,
  ];
}

function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3] + bg[3] * (1 - fg[3]);
  return [
    (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
    (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
    (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
    a,
  ];
}

function relativeLuminance([r, g, b]: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: Rgba, bg: Rgba): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe("Button variant='glass'", () => {
  it("uses concentric control radii and facet-glass-cta with no capsule override or scale/translate motion", () => {
    const { rerender } = render(
      <Button variant="glass" size="sm">
        Small glass
      </Button>
    );
    const sm = screen.getByRole("button", { name: "Small glass" });
    expect(sm).toHaveClass("facet-glass-cta", "rounded-control-sm");
    expect(sm).not.toHaveClass("rounded-full");
    expect(sm.className).not.toMatch(/active:scale-|hover:-translate-/);

    rerender(<Button variant="glass">Default glass</Button>);
    expect(screen.getByRole("button", { name: "Default glass" })).toHaveClass(
      "facet-glass-cta",
      "rounded-control"
    );
  });

  it("holds >= 7:1 contrast for text-label over the neutral glass fill at rest, hover and active in light and dark themes", () => {
    const appearances: Appearance[] = ["light", "dark"];
    for (const appearance of appearances) {
      const roles = COLOR_ROLES[appearance];
      const label = parseHex(roles.label);
      const elevated = parseHex(roles["surface-elevated"]);
      const states = [
        ["rest", mixSrgb(elevated, 78, parseRgba(roles["fill-4"]), 22)],
        ["hover", mixSrgb(elevated, 70, parseRgba(roles["fill-2"]), 30)],
        ["active", mixSrgb(elevated, 65, parseRgba(roles.fill), 35)],
      ] as const;

      for (const [state, fill] of states) {
        for (const bgRole of BACKGROUND_ROLES) {
          const backdrop = parseHex(roles[bgRole]);
          const composited = compositeOver(fill, backdrop);
          const ratio = contrastRatio(label, composited);
          expect({ appearance, state, bgRole, ok: ratio >= 7 }).toEqual({
            appearance,
            state,
            bgRole,
            ok: true,
          });
        }
      }
    }
  });
});

describe("Dashboard neutral Facet Lens glass CTAs", () => {
  it("renders DashboardHero's MyCountry link as a neutral glass control with concentric radius", () => {
    render(<DashboardHero onCollapsedChange={jest.fn()} />);
    const link = screen.getByRole("link", { name: /MyCountry/i });
    expect(link).toHaveClass("facet-glass-cta", "rounded-control-sm");
    expect(link).not.toHaveClass("rounded-full");
    expect(link.closest("[data-app]")).toBeNull();
  });

  it("renders YourRealmPanel's Open the board link as a neutral glass control without tinting the button or card", () => {
    const { container } = render(<YourRealmPanel />);
    expect(container.querySelector('[data-slot="lens-card"]')).not.toHaveAttribute("data-app");

    const openBoard = screen.getByRole("link", { name: "Open the board" });
    expect(openBoard).toHaveClass("facet-glass-cta", "rounded-control-sm");
    expect(openBoard).not.toHaveClass("rounded-full");
    expect(openBoard).not.toHaveAttribute("data-app");
  });

  it("renders DailyBlurbCard's Write a blurb and Post blurb buttons as neutral glass controls", () => {
    const { container } = render(<DailyBlurbCard />);
    expect(container.querySelector('[data-slot="lens-card"]')).not.toHaveAttribute("data-app");

    const writeBtn = screen.getByRole("button", { name: /Write a blurb/i });
    expect(writeBtn).toHaveClass("facet-glass-cta", "rounded-control-sm");
    expect(writeBtn).not.toHaveClass("rounded-full");
    expect(writeBtn).not.toHaveAttribute("data-app");

    fireEvent.click(writeBtn);
    const postBtn = screen.getByRole("button", { name: /Post blurb/i });
    expect(postBtn).toHaveClass("facet-glass-cta", "rounded-control-sm");
    expect(postBtn).not.toHaveClass("rounded-full");
    expect(postBtn).not.toHaveAttribute("data-app");
  });

  it("renders GlassCanvasComposer's Post as yourself and Share buttons as neutral glass controls", () => {
    render(
      <GlassCanvasComposer
        account={null}
        accounts={[]}
        isOwner={true}
        onPost={jest.fn()}
        countryId="c-1"
        hasCountry={true}
        onCreateAccount={jest.fn()}
      />
    );
    const postSelf = screen.getByRole("button", { name: "Post as yourself" });
    expect(postSelf).toHaveClass("facet-glass-cta", "rounded-control-sm");
    expect(postSelf).not.toHaveClass("rounded-full");
    expect(postSelf.closest("[data-app]")).toBeNull();

    render(
      <TooltipProvider>
        <ComposerActionBar
          showActionBar={true}
          remainingChars={240}
          showVisualizationPanel={false}
          setShowVisualizationPanel={jest.fn()}
          isGeneratingVisualization={false}
          setShowMediaModal={jest.fn()}
          selectedImages={[]}
          handleInsertGif={jest.fn()}
          pollDraft={null}
          setPollDraft={jest.fn()}
          setShowPollModal={jest.fn()}
          showContentWarning={false}
          setShowContentWarning={jest.fn()}
          postToDiscord={false}
          setPostToDiscord={jest.fn()}
          handleSubmit={jest.fn()}
          isPending={false}
          plainText="Hello world"
          selectedVisualizations={[]}
        />
      </TooltipProvider>
    );
    const shareBtn = screen.getByRole("button", { name: /Share$/ });
    expect(shareBtn).toHaveClass("facet-glass-cta", "rounded-control-sm");
    expect(shareBtn).not.toHaveClass("rounded-full");
    expect(shareBtn).not.toHaveAttribute("data-app");
  });
});
