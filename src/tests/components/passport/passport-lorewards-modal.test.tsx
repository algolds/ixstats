/**
 * The Passport's Lorewards sheet reads the holder's claimed names (the ones the viewer may see), never the passport
 * handle: no names, no sheet; several names, a picker above the view.
 */
import { fireEvent, render, screen } from "@testing-library/react";
jest.mock("~/components/lorewards/LorewardsView", () => ({
  LorewardsView: ({ username }: { username?: string }) => <p data-testid="view">{username}</p>,
}));
import { PassportLorewardsModal } from "~/components/passport/modals/PassportLorewardsModal";

const lorewards = (names: string[]) => ({
  totalScore: 420,
  totalBytes: 4500,
  rank: 3,
  dailyWins: 4,
  dailyRunnerUps: 3,
  weeklyWins: 3,
  monthlyWins: 1,
  currentStreak: 4,
  longestStreak: 9,
  names,
});

const open = (value: ReturnType<typeof lorewards> | null) =>
  render(<PassportLorewardsModal open onOpenChange={() => {}} lorewards={value} />);

it("renders nothing without Lorewards or without a name", () => {
  open(null);
  expect(screen.queryByRole("dialog")).toBeNull();
  open(lorewards([]));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByTestId("view")).toBeNull();
});

it("shows one name as the author identity, with its contributions link and no picker", () => {
  open(lorewards(["Alex"]));
  expect(screen.getByRole("dialog")).toHaveTextContent("Author identity: User:Alex");
  expect(screen.getByTestId("view")).toHaveTextContent("Alex");
  expect(screen.queryByRole("radiogroup", { name: "Wiki name" })).toBeNull();
  expect(screen.getByRole("link", { name: /view wiki contributions/i })).toHaveAttribute(
    "href",
    "/util/contributions/Alex"
  );
});

it("picks among several names, the first by default, and passes the choice to the view", () => {
  open(lorewards(["Alex", "Alex Two"]));
  expect(screen.getByRole("radiogroup", { name: "Wiki name" })).toBeInTheDocument();
  expect(screen.getByTestId("view")).toHaveTextContent(/^Alex$/);

  fireEvent.click(screen.getByRole("radio", { name: "Alex Two" }));

  expect(screen.getByTestId("view")).toHaveTextContent("Alex Two");
  expect(screen.getByRole("dialog")).toHaveTextContent("Author identity: User:Alex Two");
  expect(screen.getByRole("link", { name: /view wiki contributions/i })).toHaveAttribute(
    "href",
    "/util/contributions/Alex%20Two"
  );
});
