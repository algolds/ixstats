/**
 * The passport back face saves privacy toggles, the signature and signature-ribbon pins to the
 * owner's account (no session-only switches).
 */
import { beforeEach, describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";

const mutate = jest.fn();
const settings = {
  visibility: {
    accolades: true,
    impact: true,
    forumStats: true,
    vaultCards: true,
    historyStream: true,
    achievements: true,
    linkPreview: true,
  },
  signature: "A. Pav",
  pinnedRibbonKeys: ["econ-first-million"],
  ribbons: [
    {
      key: "econ-first-million",
      title: "First Million",
      category: "Economic",
      rarity: "Common",
      pinned: true,
    },
    {
      key: "mil-first-branch",
      title: "First Branch",
      category: "Military",
      rarity: "Rare",
      pinned: false,
    },
  ],
};

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () =>
      new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: jest.fn() }) }) }),
    ixnayid: {
      getPassportSettings: { useQuery: () => ({ data: settings, isFetching: false }) },
      updatePassportSettings: {
        useMutation: () => ({ mutate, isPending: false, error: null }),
      },
    },
  },
}));

import { PassportBackFace } from "~/components/passport/document/PassportBackFace";

function renderBackFace(onDone = jest.fn()) {
  render(
    <PassportBackFace isFlipped shouldReduceMotion displayName="Alex Pav" isOwner onDone={onDone} />
  );
  return onDone;
}

describe("PassportBackFace", () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  it("no longer labels the toggles as session-only", () => {
    renderBackFace();
    expect(screen.queryByText(/This Session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not saved/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Saved to your account/)).toBeInTheDocument();
  });

  it("saves a visibility toggle", () => {
    renderBackFace();
    fireEvent.click(screen.getByRole("switch", { name: "Show IxCredits" }));
    expect(mutate).toHaveBeenCalledWith({ visibility: { vaultCards: false } });
  });

  it("pins and unpins signature ribbons", () => {
    renderBackFace();
    fireEvent.click(screen.getByRole("button", { name: /First Branch/ }));
    expect(mutate).toHaveBeenCalledWith({
      pinnedRibbonKeys: ["econ-first-million", "mil-first-branch"],
    });
    fireEvent.click(screen.getByRole("button", { name: /First Million/ }));
    expect(mutate).toHaveBeenLastCalledWith({ pinnedRibbonKeys: [] });
  });

  it("saves a changed signature on Done", () => {
    const onDone = renderBackFace();
    fireEvent.change(screen.getByLabelText("Signature inscription"), {
      target: { value: " Alexander " },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Done/ })[0]!);
    expect(mutate).toHaveBeenCalledWith({ signature: "Alexander" });
    expect(onDone).toHaveBeenCalled();
  });

  it("does not save an unchanged signature", () => {
    renderBackFace();
    fireEvent.click(screen.getAllByRole("button", { name: /Done/ })[0]!);
    expect(mutate).not.toHaveBeenCalled();
  });
});
