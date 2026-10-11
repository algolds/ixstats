import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

type Reactor = {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  flagUrl: string | null;
};
type Group = { type: string; count: number; reactors: Reactor[] };
const mockEmojiOptions = jest.fn();
const mockState: {
  data: { groups: Group[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
} = { data: undefined, isLoading: false, isError: false, refetch: jest.fn() };

jest.mock("~/trpc/react", () => ({
  api: {
    thinkpages: {
      getDiscordEmojis: {
        useQuery: (_input: object, options: { enabled: boolean }) => {
          mockEmojiOptions(options);
          return { data: undefined };
        },
      },
    },
    thinkpagesForum: { reactors: { useQuery: () => mockState } },
  },
}));

import { ReactorsDialog } from "~/components/thinkpages-forum/reactions/ReactorsDialog";

const person = (name: string, flagUrl: string | null = null): Reactor => ({
  id: `rx_${name}`,
  name,
  handle: name,
  avatarUrl: null,
  flagUrl,
});
const data = (...groups: Group[]) => ({ groups });

beforeEach(() => {
  Object.assign(mockState, {
    data: data(
      { type: "fire", count: 2, reactors: [person("kir", "/f/kir.png"), person("ana")] },
      { type: "like", count: 1, reactors: [person("bo")] }
    ),
    isLoading: false,
    isError: false,
  });
  mockState.refetch.mockClear();
  mockEmojiOptions.mockClear();
});

const open = (type = "all", onClose = jest.fn()) => {
  render(<ReactorsDialog postId="p1" type={type} onClose={onClose} />);
  return onClose;
};

describe("ReactorsDialog", () => {
  it("lists everyone with their handle and flag when opened on All", () => {
    const { baseElement } = render(<ReactorsDialog postId="p1" type="all" onClose={jest.fn()} />);
    expect(screen.getByRole("dialog", { name: "Reactions" })).toBeInTheDocument();
    for (const name of ["kir", "ana", "bo"]) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText("@kir")).toBeInTheDocument();
    expect(baseElement.querySelector('img[src="/f/kir.png"]')).not.toBeNull();
    expect(screen.getByRole("radio", { name: /All \(3\)/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("opens on the clicked reaction's tab and switches tabs", () => {
    open("fire");
    expect(screen.getByRole("radio", { name: "fire, 2" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("kir")).toBeInTheDocument();
    expect(screen.queryByText("bo")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "like, 1" }));
    expect(screen.getByText("bo")).toBeInTheDocument();
    expect(screen.queryByText("kir")).toBeNull();
  });

  it("falls back to All when the opened reaction has gone", () => {
    open("angry");
    expect(screen.getByRole("radio", { name: /All \(3\)/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByText("bo")).toBeInTheDocument();
  });

  it("says when a type has more reactors than are listed", () => {
    mockState.data = data({ type: "like", count: 70, reactors: [person("bo")] });
    open("like");
    expect(screen.getByText("Showing the latest 1 of 70 like")).toBeInTheDocument();
  });

  it("shows an empty state, a loading line and a retry", () => {
    mockState.data = data();
    const { unmount } = render(<ReactorsDialog postId="p1" type="all" onClose={jest.fn()} />);
    expect(screen.getByText("No reactions yet")).toBeInTheDocument();
    unmount();

    Object.assign(mockState, { data: undefined, isLoading: true });
    const loading = render(<ReactorsDialog postId="p1" type="all" onClose={jest.fn()} />);
    expect(screen.getByText("Loading reactions")).toBeInTheDocument();
    loading.unmount();

    Object.assign(mockState, { isLoading: false, isError: true });
    render(<ReactorsDialog postId="p1" type="all" onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockState.refetch).toHaveBeenCalled();
  });

  it("loads the Discord emoji list only when a Discord reaction is listed", () => {
    const { unmount } = render(<ReactorsDialog postId="p1" type="all" onClose={jest.fn()} />);
    expect(mockEmojiOptions).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    unmount();
    mockState.data = data({ type: "discord:pog", count: 1, reactors: [person("bo")] });
    render(<ReactorsDialog postId="p1" type="all" onClose={jest.fn()} />);
    expect(mockEmojiOptions).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("announces loading as a status", () => {
    Object.assign(mockState, { data: undefined, isLoading: true });
    render(<ReactorsDialog postId="p1" type="all" onClose={jest.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading reactions");
  });

  it("closes through the dismiss button", () => {
    const onClose = open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
