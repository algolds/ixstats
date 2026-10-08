/**
 * The passport flip: the hidden face is inert (no focus or clicks leak through), the open entrance
 * plays once on the default tab only, and the back face carries the Link previews switch.
 */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Ref } from "react";
import type { PassportPayload } from "~/components/passport/types";

const mutate = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () =>
      new Proxy({}, { get: () => new Proxy({}, { get: () => ({ invalidate: jest.fn() }) }) }),
    ixnayid: {
      getPassportSettings: {
        useQuery: () => ({
          data: {
            visibility: {
              accolades: true,
              impact: true,
              forumStats: true,
              vaultCards: true,
              historyStream: true,
              achievements: true,
              linkPreview: true,
            },
            signature: null,
            pinnedRibbonKeys: [],
            ribbons: [],
          },
          isFetching: false,
        }),
      },
      updatePassportSettings: {
        useMutation: () => ({ mutate, isPending: false, error: null }),
      },
    },
  },
}));

jest.mock("~/hooks/usePublicCosmetics", () => ({ useUserCosmetics: () => null }));
jest.mock("~/components/passport/modals/PassportLorewardsModal", () => ({
  PassportLorewardsModal: () => null,
}));
jest.mock("~/components/passport/PassportTabPanels", () => ({ PassportTabBody: () => null }));
jest.mock("~/components/passport/document/PassportTabRibbon", () => ({
  PassportTabRibbon: () => null,
  passportTabId: (base: string, tab: string) => `${base}-${tab}`,
  passportTabPanelId: (base: string) => `${base}-panel`,
}));
jest.mock("~/components/passport/document/PassportFrontFace", () => ({
  PassportFrontFace: ({
    onEdit,
    editButtonRef,
  }: {
    onEdit: () => void;
    editButtonRef: Ref<HTMLButtonElement>;
  }) => (
    <button ref={editButtonRef} type="button" onClick={onEdit}>
      Edit passport
    </button>
  ),
}));

import { MidRibbonPassportDocument } from "~/components/passport/MidRibbonPassportDocument";

const data = {
  handle: "alex",
  account: { userId: "u1", isOwner: true },
  wiki: null,
  vault: null,
} as PassportPayload;

function renderDocument(activeTab: "realms" | "work" = "realms") {
  return render(
    <MidRibbonPassportDocument
      displayName="Alex Pav"
      avatarUrl={null}
      data={data}
      isOwner
      viewerSignedIn
      activeTab={activeTab}
      onSelectTab={jest.fn()}
    />
  );
}

describe("passport flip", () => {
  it("makes the back face inert until the passport is flipped, and the front face after", () => {
    renderDocument();
    const front = screen.getByTestId("passport-front-face");
    const back = screen.getByTestId("passport-back-face");
    expect(front).not.toHaveAttribute("inert");
    expect(back).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "Edit passport" }));
    expect(front).toHaveAttribute("inert");
    expect(back).not.toHaveAttribute("inert");

    fireEvent.click(screen.getAllByRole("button", { name: /Done/ })[0]!);
    expect(front).not.toHaveAttribute("inert");
    expect(back).toHaveAttribute("inert");
  });

  it("moves focus to Done on flip and back to Edit on flip-back, not on mount", () => {
    renderDocument();
    expect(document.body).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Edit passport" }));
    expect(screen.getAllByRole("button", { name: /Done/ })[0]).toHaveFocus();

    fireEvent.click(screen.getAllByRole("button", { name: /Done/ })[0]!);
    expect(screen.getByRole("button", { name: "Edit passport" })).toHaveFocus();
  });

  it("returns focus to Edit from Return to passport too", () => {
    renderDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit passport" }));
    fireEvent.click(screen.getByRole("button", { name: /Return to passport/ }));
    expect(screen.getByRole("button", { name: "Edit passport" })).toHaveFocus();
  });

  it("plays the open entrance on the default tab", () => {
    renderDocument("realms");
    expect(screen.getByTestId("passport-flip-root")).toHaveClass("animate-passport-open");
  });

  it("skips the open entrance when the page loads on another tab", () => {
    renderDocument("work");
    expect(screen.getByTestId("passport-flip-root")).not.toHaveClass("animate-passport-open");
  });

  it("does not replay the open entrance after a tab change", () => {
    const { rerender } = renderDocument("work");
    rerender(
      <MidRibbonPassportDocument
        displayName="Alex Pav"
        avatarUrl={null}
        data={data}
        isOwner
        viewerSignedIn
        activeTab="realms"
        onSelectTab={jest.fn()}
      />
    );
    expect(screen.getByTestId("passport-flip-root")).not.toHaveClass("animate-passport-open");
  });

  it("crossfades instead of rotating under reduced motion", () => {
    renderDocument();
    expect(screen.getByTestId("passport-flip-card")).toHaveClass("motion-reduce:[transform:none]");
    expect(screen.getByTestId("passport-back-face")).toHaveClass("motion-reduce:[transform:none]");
  });

  it("saves the Link previews switch", () => {
    mutate.mockClear();
    renderDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Show link previews" }));
    expect(screen.getByText("Show your card when your link is shared")).toBeInTheDocument();
    expect(mutate).toHaveBeenCalledWith({ visibility: { linkPreview: false } });
  });
});
