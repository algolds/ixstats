/** The client sign-in guard: a signed-out visitor goes to sign-in, and comes back to where they were. */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/context/auth-context", () => ({ useUser: jest.fn() }));
jest.mock("~/lib/utils/url-utils", () => {
  const actual =
    jest.requireActual<typeof import("~/lib/utils/url-utils")>("~/lib/utils/url-utils");
  return { ...actual, createUrl: jest.fn(actual.createUrl) };
});

import { useUser } from "~/context/auth-context";
import { createUrl } from "~/lib/utils/url-utils";
import { AuthenticationGuard } from "~/components/mycountry/shared/primitives/AuthenticationGuard";

const signedOut = () =>
  jest.mocked(useUser).mockReturnValue({ user: null, isLoaded: true } as never);

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom cannot navigate, and says so on the console when the guard sends the visitor to sign-in.
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("AuthenticationGuard", () => {
  it("returns a signed-out visitor to the address they opened, its query included", () => {
    window.history.replaceState(null, "", "/vault/cards/explore?card=c1&from=holder.ann");
    signedOut();
    render(
      <AuthenticationGuard>
        <p>Vault</p>
      </AuthenticationGuard>
    );
    expect(screen.queryByText("Vault")).toBeNull();
    // The redirect_url is a plain URL, so it takes the base path (createUrl).
    expect(createUrl).toHaveBeenCalledWith("/vault/cards/explore?card=c1&from=holder.ann");
  });

  it("returns to the path it is given instead, when a page names one", () => {
    window.history.replaceState(null, "", "/myclub/roster?tab=b");
    signedOut();
    render(
      <AuthenticationGuard redirectPath="/myclub">
        <p>Club</p>
      </AuthenticationGuard>
    );
    expect(createUrl).toHaveBeenCalledWith("/myclub");
  });

  it("shows a signed-in player the page and sends them nowhere", () => {
    jest.mocked(useUser).mockReturnValue({ user: { id: "u1" }, isLoaded: true } as never);
    render(
      <AuthenticationGuard>
        <p>Vault</p>
      </AuthenticationGuard>
    );
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(createUrl).not.toHaveBeenCalled();
  });
});
