/** The Vault Lorewards tab's achievements: the Lorewards category only, each linking to its entry in All. */
import { render, screen } from "@testing-library/react";
import { LorewardAchievements } from "~/components/vault/sections/LorewardAchievements";

const row = (key: string, category: string, unlockedAt: string | null) => ({
  key,
  title: `Title ${key}`,
  description: `About ${key}`,
  category,
  unlockedAt,
});

it("lists the Lorewards rows with their unlock date or not yet, each linking to the achievement", () => {
  const unlocked = "2026-10-01T12:00:00.000Z";
  render(
    <LorewardAchievements
      achievements={
        [
          row("lore_first", "Lorewards", unlocked),
          row("lore next", "Lorewards", null),
          row("collector", "Cards", unlocked),
        ] as never
      }
    />
  );
  expect(screen.getByRole("region", { name: "Lorewards achievements" })).toBeInTheDocument();
  expect(screen.getByText("About lore_first")).toBeInTheDocument();
  expect(
    screen.getByText(`Unlocked ${new Date(unlocked).toLocaleDateString()}`)
  ).toBeInTheDocument();
  expect(screen.getByText("Not yet")).toBeInTheDocument();
  expect(screen.queryByText("Title collector")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Title lore_first/ })).toHaveAttribute(
    "href",
    "/vault/achievements?a=lore_first"
  );
  expect(screen.getByRole("link", { name: /Title lore next/ })).toHaveAttribute(
    "href",
    "/vault/achievements?a=lore%20next"
  );
});

it("shows a skeleton while the catalogue loads", () => {
  const { container } = render(<LorewardAchievements achievements={undefined} />);
  expect(container.firstChild).toHaveAttribute("data-slot", "skeleton");
});

it("renders nothing with no Lorewards achievements", () => {
  const { container } = render(
    <LorewardAchievements achievements={[row("collector", "Cards", null)] as never} />
  );
  expect(container).toBeEmptyDOMElement();
});
