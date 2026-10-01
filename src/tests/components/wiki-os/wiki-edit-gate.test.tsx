/**
 * F35c: `?action=edit` opens the editor only for someone who may edit; everyone else gets MediaWiki's
 * "View source": the wikitext read-only, the reason, and a way to sign in when signed out.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

let mockAuth = { isLoaded: true, isSignedIn: false };
const mockEditAccess = jest.fn();
const mockWikitext = jest.fn();

jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({ useWikiAuth: () => mockAuth }));
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      getEditAccess: { useQuery: (...args: unknown[]) => mockEditAccess(...args) },
      getWikitext: { useQuery: (...args: unknown[]) => mockWikitext(...args) },
    },
  },
}));

import { WikiEditGate } from "~/components/wiki-os/editor/WikiEditGate";

const onClose = jest.fn();
const renderGate = () =>
  render(
    <WikiEditGate title="Vesperia" onClose={onClose}>
      <div>the live editor</div>
    </WikiEditGate>
  );

const existingPage = { data: { wikitext: "'''Vesperia''' is a nation.", revisionRef: "rev-1" }, isLoading: false, isError: false };

describe("WikiEditGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { isLoaded: true, isSignedIn: false };
    mockEditAccess.mockReturnValue({ data: undefined, isLoading: false });
    mockWikitext.mockReturnValue(existingPage);
  });

  it("shows a signed-out reader the source, read-only, with a way to sign in and no editor", () => {
    renderGate();

    expect(screen.queryByText("the live editor")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "View source for Vesperia" })).toBeInTheDocument();
    const source = screen.getByLabelText("Wikitext source of Vesperia") as HTMLTextAreaElement;
    expect(source.readOnly).toBe(true);
    expect(source.value).toBe("'''Vesperia''' is a nation.");
    expect(screen.getByRole("status").textContent).toContain("You must be signed in to edit this page.");
    expect(screen.getByRole("link", { name: "Sign in to edit" })).toHaveAttribute(
      "href",
      "/sign-in?redirect_url=%2Fwiki%2FVesperia%3Faction%3Dedit"
    );
    // the server is not asked for a reader who cannot edit anyway
    expect(mockEditAccess.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("goes back to the page", () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Back to page" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tells a signed-out reader they cannot create a page that does not exist, and shows no source", () => {
    mockWikitext.mockReturnValue({ data: { wikitext: "", revisionRef: null }, isLoading: false, isError: false });
    renderGate();

    expect(screen.getByRole("heading", { name: "Cannot create Vesperia" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Wikitext source of Vesperia")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to create this page" })).toBeInTheDocument();
  });

  it("opens the editor for a signed-in user the server allows", () => {
    mockAuth = { isLoaded: true, isSignedIn: true };
    mockEditAccess.mockReturnValue({ data: { allowed: true, reason: null }, isLoading: false });
    renderGate();

    expect(screen.getByText("the live editor")).toBeInTheDocument();
    expect(mockEditAccess.mock.calls[0]?.[1]).toMatchObject({ enabled: true });
  });

  it("shows a signed-in user the source and the server's reason when the page is closed to them", () => {
    mockAuth = { isLoaded: true, isSignedIn: true };
    mockEditAccess.mockReturnValue({
      data: { allowed: false, reason: "This page is protected from edit (sysop)." },
      isLoading: false,
    });
    renderGate();

    expect(screen.queryByText("the live editor")).not.toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toContain(
      "You do not have permission to edit this page. This page is protected from edit (sysop)."
    );
    expect(screen.queryByRole("link", { name: "Sign in to edit" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Wikitext source of Vesperia")).toBeInTheDocument();
  });

  it("waits for the account and for the answer before opening anything", () => {
    mockAuth = { isLoaded: false, isSignedIn: false };
    const first = renderGate();
    expect(screen.getByRole("status", { name: "Checking edit access" })).toBeInTheDocument();
    expect(screen.queryByText("the live editor")).not.toBeInTheDocument();
    first.unmount();

    mockAuth = { isLoaded: true, isSignedIn: true };
    mockEditAccess.mockReturnValue({ data: undefined, isLoading: true });
    renderGate();
    expect(screen.getByRole("status", { name: "Checking edit access" })).toBeInTheDocument();
    expect(screen.queryByText("the live editor")).not.toBeInTheDocument();
  });

  it("opens the editor when the access check itself fails: the save is checked again", () => {
    mockAuth = { isLoaded: true, isSignedIn: true };
    mockEditAccess.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderGate();
    expect(screen.getByText("the live editor")).toBeInTheDocument();
  });

  it("says so when the source cannot be loaded", () => {
    mockWikitext.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderGate();
    expect(screen.getByRole("alert").textContent).toContain("could not be loaded");
    expect(screen.getByRole("button", { name: "Back to page" })).toBeInTheDocument();
  });
});
