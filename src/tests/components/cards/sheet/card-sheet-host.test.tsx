import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));
jest.mock("~/components/cards/sheet/CardSheet", () => ({
  CardSheet: ({
    cardId,
    from,
    onClose,
  }: {
    cardId: string;
    from: { kind: string } | null;
    onClose: () => void;
  }) => (
    <div role="dialog">
      Sheet {cardId} from {from?.kind ?? "nowhere"}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import { useSearchParams } from "next/navigation";
import { CardSheetHost } from "~/components/cards/sheet/CardSheetHost";

const withParams = (query: string) =>
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as never);

afterEach(() => jest.restoreAllMocks());

describe("CardSheetHost", () => {
  it("opens the sheet the address names, with where it was opened from", async () => {
    withParams("card=c1&from=offer.t1");
    render(<CardSheetHost />);
    expect(await screen.findByText("Sheet c1 from offer")).toBeInTheDocument();
  });

  it("closes it through the address", async () => {
    window.history.replaceState(null, "", "/vault/cards/mine?card=c1");
    const pushState = jest.spyOn(window.history, "pushState");
    withParams("card=c1");
    render(<CardSheetHost />);
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/vault/cards/mine");
  });

  it("shows nothing without a card", () => {
    withParams("realm=r1");
    const { container } = render(<CardSheetHost />);
    expect(container).toBeEmptyDOMElement();
  });
});
