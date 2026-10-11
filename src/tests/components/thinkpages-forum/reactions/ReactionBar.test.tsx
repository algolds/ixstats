import React from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";

const mockHook = { set: jest.fn(async (_next: string | null) => undefined), pending: false };
const mockMounted = jest.fn();
jest.mock("~/components/thinkpages-forum/reactions/useForumReaction", () => ({
  useForumReaction: () => {
    mockMounted();
    return mockHook;
  },
}));
const mockReactors = {
  groups: [
    {
      type: "fire",
      count: 2,
      reactors: [
        { id: "rx1", name: "kir", handle: "kir", avatarUrl: null, flagUrl: null },
        { id: "rx2", name: "ana", handle: "ana", avatarUrl: null, flagUrl: null },
      ],
    },
  ],
};
jest.mock("~/trpc/react", () => ({
  api: {
    thinkpages: {
      getDiscordEmojis: {
        useQuery: () => ({
          data: {
            emojis: [
              { id: "1", name: "sparkle", url: "https://cdn.discordapp.com/emojis/111.png" },
            ],
          },
        }),
      },
    },
    thinkpagesForum: {
      reactors: {
        useQuery: () => ({
          data: mockReactors,
          isLoading: false,
          isError: false,
          refetch: jest.fn(),
        }),
      },
    },
  },
}));
const mockPopupProps = jest.fn();
jest.mock("~/components/thinkpages/ReactionPopup", () => ({
  ReactionPopup: (props: { onSelectReaction: (type: string) => void }) => {
    mockPopupProps(props);
    const { onSelectReaction } = props;
    return (
      <div>
        <button type="button" onClick={() => onSelectReaction("fire")}>
          pick fire
        </button>
        <button type="button" onClick={() => onSelectReaction("like")}>
          pick like
        </button>
      </div>
    );
  },
}));

import { ReactionBar } from "~/components/thinkpages-forum/reactions";

type Props = React.ComponentProps<typeof ReactionBar>;
function bar(props: Partial<Props> = {}) {
  return render(<ReactionBar postId="p1" counts={{}} mine={null} canReact {...props} />);
}
const reactButton = () => screen.getByRole("button", { name: "React" });

beforeEach(() => {
  mockHook.set.mockClear();
  mockHook.pending = false;
  mockMounted.mockClear();
  mockPopupProps.mockClear();
});

describe("ReactionBar visibility", () => {
  it("renders nothing for a reader who cannot react to a post with no reactions", () => {
    const { container } = bar({ canReact: false });
    expect(container).toBeEmptyDOMElement();
    expect(mockMounted).not.toHaveBeenCalled();
  });

  it("shows the pills but no React button to a reader who cannot react", () => {
    bar({ canReact: false, counts: { fire: 2, like: 1 } });
    expect(screen.queryByRole("button", { name: "React" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Choose a reaction" })).toBeNull();
    expect(screen.getByRole("button", { name: /2 fire/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 like/ })).toBeInTheDocument();
  });

  it("shows only the React button when the post has no reactions yet", () => {
    bar();
    expect(reactButton()).toHaveTextContent("React");
    expect(screen.queryByRole("button", { name: /see who reacted/ })).toBeNull();
  });

  it("labels a Discord pill by its name and leaves the image to the label", () => {
    const { container } = bar({ canReact: false, counts: { "discord:sparkle": 2 } });
    expect(
      screen.getByRole("button", { name: "2 :sparkle:, see who reacted" })
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("orders the pills by count and tints the viewer's own", () => {
    bar({ counts: { like: 1, fire: 3 }, mine: "like" });
    const pills = screen.getAllByRole("button", { name: /see who reacted/ });
    expect(pills.map((pill) => pill.getAttribute("aria-label"))).toEqual([
      "3 fire, see who reacted",
      "1 like, yours included, see who reacted",
    ]);
    expect(pills[1]!.className).toContain("bg-tint-fill");
    expect(pills[0]!.className).not.toContain("bg-tint-fill");
  });

  it("draws a Discord reaction from the emoji list, and from its id when it has one", () => {
    const { container } = bar({ counts: { "discord:sparkle": 1, "discord:ghost:222": 1 } });
    expect(
      container.querySelector('img[src="https://cdn.discordapp.com/emojis/111.png"]')
    ).not.toBeNull();
    expect(
      container.querySelector('img[src="https://cdn.discordapp.com/emojis/222.png"]')
    ).not.toBeNull();
  });
});

describe("ReactionBar many reaction types", () => {
  const many = (): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 14; i += 1) counts[`discord:emo${String(i).padStart(2, "0")}`] = 20 - i;
    return counts;
  };

  it("shows the top twelve types and a +N more note that is not a button", () => {
    bar({ canReact: false, counts: many() });
    expect(screen.getAllByRole("button", { name: /see who reacted/ })).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /emo12/ })).toBeNull();
    const note = screen.getByRole("img", { name: "2 more reaction types" });
    expect(note).toHaveTextContent("+2 more");
    expect(note.closest("button")).toBeNull();
  });

  it("always gives the viewer's own reaction a pill, in place of the twelfth", () => {
    bar({ canReact: false, counts: many(), mine: "discord:emo13" });
    const pills = screen.getAllByRole("button", { name: /see who reacted/ });
    expect(pills).toHaveLength(12);
    expect(pills[11]).toHaveAttribute("aria-label", "7 :emo13:, yours included, see who reacted");
    expect(screen.queryByRole("button", { name: /:emo11:/ })).toBeNull();
    expect(screen.getByRole("img", { name: "2 more reaction types" })).toBeInTheDocument();
  });
});

describe("ReactionBar React button", () => {
  it("adds like when the viewer has no reaction", () => {
    bar();
    fireEvent.click(reactButton());
    expect(mockHook.set).toHaveBeenCalledWith("like");
  });

  it("shows pressed and removes the reaction, whatever its type, when the viewer has one", () => {
    bar({ counts: { fire: 1 }, mine: "fire" });
    expect(reactButton()).toHaveTextContent("React");
    expect(reactButton()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(reactButton());
    expect(mockHook.set).toHaveBeenCalledWith(null);
  });

  it("keeps its tint on hover and suppresses text selection and the touch callout", () => {
    bar({ counts: { fire: 1 }, mine: "fire" });
    expect(reactButton().className).toContain("hover:text-tint");
    expect(reactButton().className).not.toContain("hover:text-label");
    expect(reactButton().className).toContain("select-none");
  });

  it("is disabled while a request is in flight", () => {
    mockHook.pending = true;
    bar();
    expect(reactButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose a reaction" })).toBeDisabled();
  });
});

describe("ReactionBar popup", () => {
  it("opens from the chevron; choosing a type reacts and closes it", () => {
    bar();
    fireEvent.click(screen.getByRole("button", { name: "Choose a reaction" }));
    fireEvent.click(screen.getByText("pick fire"));
    expect(mockHook.set).toHaveBeenCalledWith("fire");
    expect(screen.queryByText("pick fire")).toBeNull();
  });

  it("reaches the chevron with the keyboard and moves focus into the popup it opens", () => {
    bar();
    const chevron = screen.getByRole("button", { name: "Choose a reaction" });
    chevron.focus();
    expect(chevron).toHaveFocus();
    expect(chevron).not.toHaveAttribute("tabindex", "-1");
    fireEvent.click(chevron);
    expect(screen.getByText("pick fire")).toHaveFocus();
  });

  it("gives the popup no counts of its own", () => {
    bar({ counts: { like: 1 } });
    fireEvent.click(screen.getByRole("button", { name: "Choose a reaction" }));
    expect(mockPopupProps).toHaveBeenCalledWith({ onSelectReaction: expect.any(Function) });
  });

  it("switches to another type, and removes the reaction when the current type is chosen again", () => {
    bar({ counts: { like: 1 }, mine: "like" });
    fireEvent.click(screen.getByRole("button", { name: "Choose a reaction" }));
    fireEvent.click(screen.getByText("pick fire"));
    expect(mockHook.set).toHaveBeenLastCalledWith("fire");
    fireEvent.click(screen.getByRole("button", { name: "Choose a reaction" }));
    fireEvent.click(screen.getByText("pick like"));
    expect(mockHook.set).toHaveBeenLastCalledWith(null);
  });

  it("opens on a right-click without reacting", () => {
    bar();
    fireEvent.contextMenu(reactButton());
    expect(screen.getByText("pick fire")).toBeInTheDocument();
    expect(mockHook.set).not.toHaveBeenCalled();
  });

  describe("long press", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("opens after 450 ms, and the click that ends the press does not react", () => {
      bar();
      fireEvent.pointerDown(reactButton());
      act(() => {
        jest.advanceTimersByTime(450);
      });
      expect(screen.getByText("pick fire")).toBeInTheDocument();
      fireEvent.pointerUp(reactButton());
      fireEvent.click(reactButton());
      expect(mockHook.set).not.toHaveBeenCalled();
    });

    it("does not react on the click that follows a touch long press (pointer-up, then pointer-leave)", () => {
      bar();
      fireEvent.pointerDown(reactButton());
      act(() => {
        jest.advanceTimersByTime(450);
      });
      fireEvent.pointerUp(reactButton());
      fireEvent.pointerLeave(reactButton());
      fireEvent.click(reactButton());
      expect(screen.getByText("pick fire")).toBeInTheDocument();
      expect(mockHook.set).not.toHaveBeenCalled();
    });

    it("ignores a non-primary pointer", () => {
      bar();
      // jsdom has no PointerEvent, so the init dictionary drops isPrimary: set it on the event itself.
      const secondFinger = createEvent.pointerDown(reactButton());
      Object.defineProperty(secondFinger, "isPrimary", { value: false });
      fireEvent(reactButton(), secondFinger);
      act(() => {
        jest.advanceTimersByTime(450);
      });
      expect(screen.queryByText("pick fire")).toBeNull();
    });

    it("does not swallow a keyboard activation after a long press whose click never came", () => {
      bar();
      fireEvent.pointerDown(reactButton());
      act(() => {
        jest.advanceTimersByTime(450);
      });
      fireEvent.pointerLeave(reactButton());
      fireEvent.click(reactButton());
      expect(mockHook.set).toHaveBeenCalledWith("like");
    });

    it("does not swallow a later click once the tick after the press has passed", () => {
      bar();
      fireEvent.pointerDown(reactButton());
      act(() => {
        jest.advanceTimersByTime(450);
      });
      fireEvent.pointerUp(reactButton());
      act(() => {
        jest.advanceTimersByTime(1);
      });
      fireEvent.click(reactButton());
      expect(mockHook.set).toHaveBeenCalledWith("like");
    });

    it("does nothing when the press ends sooner, and the click is an ordinary react", () => {
      bar();
      fireEvent.pointerDown(reactButton());
      act(() => {
        jest.advanceTimersByTime(200);
      });
      fireEvent.pointerUp(reactButton());
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(screen.queryByText("pick fire")).toBeNull();
      fireEvent.click(reactButton());
      expect(mockHook.set).toHaveBeenCalledWith("like");
    });
  });
});

describe("ReactionBar reactors dialog", () => {
  it("opens from a pill on that pill's reaction", () => {
    bar({ counts: { fire: 2, like: 1 }, canReact: false });
    fireEvent.click(screen.getByRole("button", { name: /2 fire/ }));
    expect(screen.getByRole("dialog", { name: "Reactions" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "fire, 2" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("kir")).toBeInTheDocument();
  });
});
