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
  render(<PassportBackFace isFlipped displayName="Alex Pav" isOwner onDone={onDone} />);
  return onDone;
}

describe("PassportBackFace", () => {
  beforeEach(() => {
    mutate.mockClear();
  });
  it("saves a visibility toggle", () => {
    renderBackFace();
    fireEvent.click(screen.getByRole("switch", { name: "Show IxCredits" }));
    expect(mutate).toHaveBeenCalledWith({ visibility: { vaultCards: false } });
  });

  it("saves the Link previews switch with a plain-words helper", () => {
    renderBackFace();
    expect(screen.getByText("Show your card when your link is shared")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Show link previews" }));
    expect(mutate).toHaveBeenCalledWith({ visibility: { linkPreview: false } });
  });
});
