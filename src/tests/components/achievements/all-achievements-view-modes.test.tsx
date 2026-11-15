import { fireEvent, render, screen, within } from "@testing-library/react";
import { RibbonBar } from "~/components/achievements/FloatingRibbonRack";
import {
  AchievementsSummaryCard,
  RarestEarnedMedalsShelf,
} from "~/components/achievements/AchievementsSummaryCard";
import { AllAchievementsTab } from "~/components/achievements/tabs/AllAchievementsTab";

let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

const ACHIEVEMENTS = [
  {
    key: "social-first-thinkpage",
    title: "First dispatch",
    description: "Publish your opening ThinkPage article.",
    category: "Social",
    rarity: "Common",
    points: 10,
    iconUrl: "EditPencil",
    isUnlocked: true,
    unlockedAt: "2026-10-05T12:00:00.000Z",
    globalUnlockPercent: 45,
  },
  {
    key: "social-thinkpage-author",
    title: "Regular columnist",
    description: "Publish 10 ThinkPage articles.",
    category: "Social",
    rarity: "Rare",
    points: 25,
    iconUrl: "EditPencil",
    isUnlocked: false,
    unlockedAt: null,
    globalUnlockPercent: 18,
  },
  {
    key: "social-prolific-author",
    title: "Syndicated voice",
    description: "Publish 50 ThinkPage articles.",
    category: "Social",
    rarity: "Legendary",
    points: 75,
    iconUrl: "EditPencil",
    isUnlocked: false,
    unlockedAt: null,
    globalUnlockPercent: 2,
  },
  {
    key: "econ-surplus-architect",
    title: "Surplus architect",
    description: "Maintain a balanced national treasury across four quarters.",
    category: "Economic",
    rarity: "Epic",
    points: 60,
    iconUrl: "StatUp",
    isUnlocked: true,
    unlockedAt: "2026-11-01T12:00:00.000Z",
    globalUnlockPercent: 4.2,
  },
  {
    key: "cards-vault-curator",
    title: "Vault curator",
    description: "Collect 100 distinct cards in your Vault.",
    category: "Cards",
    rarity: "Epic",
    points: 50,
    iconUrl: "Archive",
    isUnlocked: false,
    unlockedAt: null,
    globalUnlockPercent: 8,
  },
  {
    key: "vid-midnight-signal",
    title: "Midnight broadcast",
    description: "Tune in to the midnight dispatch.",
    category: "General",
    rarity: "Rare",
    points: 30,
    iconUrl: "Bell",
    isUnlocked: false,
    unlockedAt: null,
    globalUnlockPercent: 3,
  },
];

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
});

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
});

describe("Achievements mastery summary, rarest medal shelf, and grouped FacetList catalogue", () => {
  it("renders mastery summary and CutoutCard rarest medal shelf without aurora blurs or banned copy", () => {
    const { container } = render(
      <>
        <AchievementsSummaryCard achievements={ACHIEVEMENTS as never} />
        <RarestEarnedMedalsShelf achievements={ACHIEVEMENTS as never} />
      </>
    );

    expect(screen.getByText("2 of 6 earned")).toBeInTheDocument();
    expect(screen.getByText("70 pts")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Catalogue mastery" })).toHaveClass("bg-fill-3");

    expect(screen.getByRole("heading", { name: "Rarest earned medals" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="cutout-card"]')).toHaveLength(2);
    expect(screen.getByText("4.2% of players")).toBeInTheDocument();
    expect(container.querySelector(".facet-aurora")).toBeNull();
    expect(container.textContent?.toLowerCase()).not.toContain("unlock");
  });

  it("renders inset grouped FacetList sections by category, Roman-numeral tier pips, and trailing status", () => {
    const { container } = render(<AllAchievementsTab achievements={ACHIEVEMENTS as never} />);

    expect(container.querySelector('[data-slot="facet-list"]')).not.toBeNull();
    // 4 categories present: Cards, Economic, General, Social
    const sections = container.querySelectorAll('[data-slot="facet-list-section"]');
    expect(sections).toHaveLength(4);

    // Earned standalone row displays +points and Earned badge
    expect(screen.getByText("+60 pts")).toBeInTheDocument();
    expect(screen.getByText("Earned")).toBeInTheDocument();

    // Series row renders inline Roman-numeral tier pips (earned = semantic category wash, upcoming = bg-fill-3 text-label-tertiary)
    const tierOneBtn = screen.getByRole("button", { name: "Tier I: First dispatch (earned)" });
    const tierTwoBtn = screen.getByRole("button", {
      name: "Tier II: Regular columnist (not earned)",
    });
    const tierThreeBtn = screen.getByRole("button", {
      name: "Tier III: Syndicated voice (not earned)",
    });

    expect(tierOneBtn).toHaveClass("bg-blue/15", "text-blue-ink");
    expect(tierTwoBtn).toHaveClass("bg-fill-3", "text-label-tertiary");
    expect(tierTwoBtn.className).toContain("pointer-coarse:after:min-h-11");

    // In-progress series trailing status shows 1 / 3 + compact progress bar
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "ThinkPages Thought Leadership progress" })
    ).toBeInTheDocument();

    // Clicking Tier III updates the requirement subtitle to Tier III's requirement
    fireEvent.click(tierThreeBtn);
    expect(
      screen.getByText("Syndicated voice: Publish 50 ThinkPage articles.")
    ).toBeInTheDocument();

    // Secret not-earned achievement reveals cleanly
    expect(screen.getByText("Hidden achievement · Earn to reveal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal secret" }));
    expect(screen.getByText("Midnight broadcast")).toBeInTheDocument();

    expect(container.textContent?.toLowerCase()).not.toContain("unlock");
  });

  it("collapses to a single FacetListSection when filtering to one category and filters by status and search", () => {
    const { container } = render(<AllAchievementsTab achievements={ACHIEVEMENTS as never} />);

    // Filter to Economic category via ActionPill
    const categoryGroup = screen.getByRole("group", { name: "Category" });
    fireEvent.click(within(categoryGroup).getByRole("button", { name: "Economic" }));

    expect(container.querySelectorAll('[data-slot="facet-list-section"]')).toHaveLength(1);
    expect(screen.getByText("Surplus architect")).toBeInTheDocument();
    expect(screen.queryByText("Vault curator")).not.toBeInTheDocument();

    // Switch back to All categories, then filter status -> In progress
    fireEvent.click(within(categoryGroup).getByRole("button", { name: "All" }));
    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    fireEvent.keyDown(statusTrigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "In progress" }));

    expect(screen.getByText("ThinkPages Thought Leadership")).toBeInTheDocument();
    expect(screen.queryByText("Surplus architect")).not.toBeInTheDocument();
    expect(screen.queryByText("Vault curator")).not.toBeInTheDocument();

    // Search query narrows results and Reset filters restores full catalogue
    const searchInput = screen.getByRole("searchbox", { name: "Search achievements" });
    fireEvent.change(searchInput, { target: { value: "nonexistent milestone" } });
    expect(screen.getByText("No achievements match")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(container.querySelectorAll('[data-slot="facet-list-section"]')).toHaveLength(4);
  });

  it("pre-filters to a category when opened with ?category=<name> and tints the pressed category pill", () => {
    mockSearchParams = new URLSearchParams("category=Economic");
    const { container } = render(<AllAchievementsTab achievements={ACHIEVEMENTS as never} />);

    expect(container.querySelectorAll('[data-slot="facet-list-section"]')).toHaveLength(1);
    expect(screen.getByText("Surplus architect")).toBeInTheDocument();
    expect(screen.queryByText("Vault curator")).not.toBeInTheDocument();

    const categoryGroup = screen.getByRole("group", { name: "Category" });
    const economicPill = within(categoryGroup).getByRole("button", { name: "Economic" });
    expect(economicPill).toHaveAttribute("aria-pressed", "true");
    expect(economicPill).toHaveClass("bg-green/15", "text-green-ink");
  });

  it("highlights the matching FacetRow with tint selection when deep-linked via ?a=<key>", () => {
    mockSearchParams = new URLSearchParams("a=social-prolific-author");
    const { container } = render(<AllAchievementsTab achievements={ACHIEVEMENTS as never} />);

    const highlighted = container.querySelectorAll(
      '[data-slot="facet-row-item"][data-selected="true"][data-selection-style="tint"]'
    );
    expect(highlighted).toHaveLength(1);
    expect(
      within(highlighted[0] as HTMLElement).getByText("ThinkPages Thought Leadership")
    ).toBeInTheDocument();
    // Deep-linking to Tier III inspects Tier III immediately
    expect(
      within(highlighted[0] as HTMLElement).getByText(
        "Syndicated voice: Publish 50 ThinkPage articles."
      )
    ).toBeInTheDocument();
  });

  it("renders ribbon weave texture class from card-art.css without inline repeating-linear-gradient", () => {
    const { container } = render(
      <RibbonBar
        ribbon={{
          key: "social-first-thinkpage",
          title: "First dispatch",
          category: "Social",
          rarity: "Rare",
        }}
      />
    );

    expect(container.querySelector(".ribbon-weave")).not.toBeNull();
    expect(container.innerHTML).not.toContain("repeating-linear-gradient");
  });
});
