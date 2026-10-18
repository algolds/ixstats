import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    cards: { requestTakedown: { useMutation: jest.fn() } },
    loreCards: { getCardAuthorInfo: { useQuery: jest.fn(() => ({ data: undefined })) } },
  },
}));
jest.mock("~/components/cards/display/LoreWikiExcerpt", () => ({
  LoreWikiExcerpt: () => <p>Excerpt</p>,
}));
jest.mock("~/components/cards/display/CardTakedownVerificationModal", () => ({
  CardTakedownVerificationModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="alertdialog">NationStates takedown</div> : null,
}));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CardSheetAbout } from "~/components/cards/sheet/CardSheetAbout";
import type { CardSheetData } from "~/lib/cards/hub/sheet";

type Answer = { status: "filed" | "already" };
interface MutationOptions {
  onSuccess: (answer: Answer) => void;
  onError: (error: { message: string }) => void;
}

const card: CardSheetData["card"] = {
  id: "c1",
  title: "Caphiria",
  cardType: "LORE",
  rarity: "EPIC",
  isBound: false,
  isRetired: false,
  category: "HISTORY",
  description: null,
  wikiSource: "ixwiki",
  wikiArticleTitle: "Caphiria",
  excerpt: null,
  author: null,
  descriptionUrl: null,
  artCredit: null,
  ns: null,
  value: 1200,
};
const nsCard: CardSheetData["card"] = {
  ...card,
  cardType: "NS",
  wikiSource: null,
  wikiArticleTitle: null,
  ns: {
    nation: "Testlandia",
    season: 3,
    region: "Lazarus",
    category: "Civil Rights Lovefest",
    cardUrl: null,
    nationUrl: "https://www.nationstates.net/nation=testlandia",
  },
};
const REASON = "It shows my house without asking";
const mutate = jest.fn();

/** The request answers with `outcome`: the server's status, or an error's message. */
function answerWith(outcome: Answer | { message: string }) {
  jest.mocked(api.cards.requestTakedown.useMutation).mockImplementation(((
    options: MutationOptions
  ) => ({
    isPending: false,
    mutate: (input: object) => {
      mutate(input);
      if ("status" in outcome) options.onSuccess(outcome);
      else options.onError(outcome);
    },
  })) as never);
}

const about = (props: { card?: CardSheetData["card"]; signedIn: boolean }) =>
  render(<CardSheetAbout card={props.card ?? card} artHidden={false} signedIn={props.signedIn} />);

/** Opens the request dialog from the About section. */
function openRequest() {
  fireEvent.click(screen.getByRole("button", { name: "Request a takedown" }));
  return screen.getByRole("dialog", { name: "Request a takedown" });
}

beforeEach(() => {
  jest.clearAllMocks();
  answerWith({ status: "filed" });
});

describe("requesting a takedown from the card sheet", () => {
  it("lets a signed-in player ask for a card to come down, with a reason of at least 10 characters", () => {
    about({ signedIn: true });
    expect(screen.queryByRole("link", { name: "How to ask for a takedown" })).toBeNull();
    const dialog = openRequest();
    const send = within(dialog).getByRole("button", { name: "Send request" });
    const reason = within(dialog).getByLabelText("Why should this card come down?");

    expect(reason).toHaveAccessibleDescription("10 to 1,000 characters.");
    expect(send).toBeDisabled();
    fireEvent.change(reason, { target: { value: "   too short   " } });
    expect(send).toBeDisabled();
    fireEvent.change(reason, { target: { value: `  ${REASON}  ` } });
    fireEvent.change(within(dialog).getByLabelText("How can staff reach you?"), {
      target: { value: " me@example.org " },
    });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    expect(mutate).toHaveBeenCalledWith({
      cardId: "c1",
      reason: REASON,
      contact: "me@example.org",
    });
    expect(vaultNotify.success).toHaveBeenCalledWith(
      "Request sent. Staff answer takedowns within 14 days.",
      "Caphiria"
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sends no contact when the player leaves it empty", () => {
    about({ signedIn: true });
    const dialog = openRequest();
    fireEvent.change(within(dialog).getByLabelText("Why should this card come down?"), {
      target: { value: REASON },
    });
    fireEvent.change(within(dialog).getByLabelText("How can staff reach you?"), {
      target: { value: "   " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(mutate).toHaveBeenCalledWith({ cardId: "c1", reason: REASON, contact: undefined });
  });

  it("says when staff already have a request for the card", () => {
    answerWith({ status: "already" });
    about({ signedIn: true });
    const dialog = openRequest();
    fireEvent.change(within(dialog).getByLabelText("Why should this card come down?"), {
      target: { value: REASON },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(vaultNotify.success).toHaveBeenCalledWith(
      "Staff already have a request for this card.",
      "Caphiria"
    );
  });

  it("keeps the request open with what was typed when it is refused", () => {
    answerWith({ message: "You have 5 requests waiting. Staff will answer those first." });
    about({ signedIn: true });
    const dialog = openRequest();
    fireEvent.change(within(dialog).getByLabelText("Why should this card come down?"), {
      target: { value: REASON },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(vaultNotify.error).toHaveBeenCalledWith(
      "You have 5 requests waiting. Staff will answer those first."
    );
    expect(vaultNotify.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Request a takedown" })).toBeInTheDocument();
    expect(screen.getByLabelText("Why should this card come down?")).toHaveValue(REASON);
  });

  it("points a signed-out visitor to the takedown help instead", () => {
    about({ signedIn: false });
    expect(screen.getByRole("link", { name: "How to ask for a takedown" })).toHaveAttribute(
      "href",
      "/help/vault/lore-cards#takedowns"
    );
    expect(screen.queryByRole("button", { name: "Request a takedown" })).toBeNull();
  });

  it.each([true, false])(
    "keeps the NationStates flow on an NS card (signed in: %s)",
    (signedIn) => {
      about({ card: nsCard, signedIn });
      expect(screen.queryByRole("button", { name: "Request a takedown" })).toBeNull();
      expect(screen.queryByRole("link", { name: "How to ask for a takedown" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Verify & request takedown/ }));
      expect(screen.getByRole("alertdialog")).toHaveTextContent("NationStates takedown");
    }
  );
});
