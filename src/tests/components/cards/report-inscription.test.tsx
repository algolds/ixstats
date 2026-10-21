/**
 * Reporting another player's inscription: a reason, sent to staff; the server's refusal (five reports already waiting,
 * or one already sent) is shown in the dialog; focus goes back to the report button.
 */
import "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/hooks/cards/useMarketActions", () => ({ useMarketActions: jest.fn() }));

import { useMarketActions } from "~/hooks/cards/useMarketActions";
import { ReportInscriptionButton } from "~/components/cards/inscription/ReportInscriptionButton";

type Done = { onSuccess?: () => void; onError?: (error: { message: string }) => void };

function setup(isPending = false) {
  const mutate = jest.fn();
  jest.mocked(useMarketActions).mockReturnValue({ report: { mutate, isPending } } as never);
  render(<ReportInscriptionButton ownershipId="o1" cardId="c1" />);
  const opener = screen.getByRole("button", { name: "Report inscription" });
  opener.focus();
  fireEvent.click(opener);
  return { mutate, opener };
}
const reason = () => screen.getByLabelText("What is wrong with it?");
const send = () => screen.getByRole("button", { name: "Send report" });

describe("ReportInscriptionButton", () => {
  it("reports an inscription with a reason, then closes and gives focus back", async () => {
    const { mutate, opener } = setup();
    expect(useMarketActions).toHaveBeenCalledWith("c1");
    fireEvent.change(reason(), { target: { value: "  A slur " } });
    fireEvent.click(send());
    expect(mutate).toHaveBeenCalledWith({ ownershipId: "o1", reason: "A slur" }, expect.anything());
    act(() => (mutate.mock.calls[0]![1] as Done).onSuccess!());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("asks for a reason of at least 3 characters", () => {
    const { mutate } = setup();
    fireEvent.change(reason(), { target: { value: " ab " } });
    expect(send().hasAttribute("disabled")).toBe(true);
    fireEvent.submit(send().closest("form")!);
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.change(reason(), { target: { value: "abc" } });
    expect(send().hasAttribute("disabled")).toBe(false);
  });

  it("shows the server's refusal, past five waiting reports, in the dialog and keeps it open", () => {
    const { mutate } = setup();
    fireEvent.change(reason(), { target: { value: "A slur" } });
    fireEvent.click(send());
    act(() =>
      (mutate.mock.calls[0]![1] as Done).onError!({
        message: "You have 5 reports waiting. Staff will answer those first.",
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toContain(
      "You have 5 reports waiting. Staff will answer those first."
    );
    // Sending again clears it while it runs
    fireEvent.click(send());
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(mutate).toHaveBeenCalledTimes(2);
  });
  it("holds Send while the report is under way", () => {
    setup(true);
    fireEvent.change(reason(), { target: { value: "A slur" } });
    expect(send().hasAttribute("disabled")).toBe(true);
  });
});
