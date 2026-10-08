import React, { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { useAuth } from "~/context/auth-context";
import { LazyGameProviders } from "~/components/providers/LazyGameProviders";

jest.mock("~/context/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock(
  "next/dynamic",
  () => () =>
    function Sidecar() {
      return require("react").createElement("span", { "data-testid": "sidecar" });
    }
);

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
type AuthState = ReturnType<typeof useAuth>;

function authState(isLoaded: boolean, isSignedIn: boolean): AuthState {
  return { isLoaded, isSignedIn } as AuthState;
}

let mountCount = 0;

function Probe() {
  useEffect(() => {
    mountCount++;
  }, []);
  return <div data-testid="probe" />;
}

describe("LazyGameProviders", () => {
  beforeEach(() => {
    mountCount = 0;
  });

  it("does not remount children when auth resolves", () => {
    mockUseAuth.mockReturnValue(authState(false, false));
    const { rerender } = render(
      <LazyGameProviders>
        <Probe />
      </LazyGameProviders>
    );

    mockUseAuth.mockReturnValue(authState(true, true));
    rerender(
      <LazyGameProviders>
        <Probe />
      </LazyGameProviders>
    );

    expect(mountCount).toBe(1);
    expect(screen.getByTestId("sidecar")).toBeTruthy();
  });

  it("renders no sidecar when signed out", () => {
    mockUseAuth.mockReturnValue(authState(true, false));
    render(
      <LazyGameProviders>
        <Probe />
      </LazyGameProviders>
    );

    expect(screen.queryByTestId("sidecar")).toBeNull();
    expect(screen.getByTestId("probe")).toBeTruthy();
  });

  it("hydrates a signed-in page without a mismatch, adding the sidecar after hydration", () => {
    // The server never knows the session; the browser's auth can already be loaded while hydrating.
    mockUseAuth.mockReturnValue(authState(false, false));
    const tree = (
      <LazyGameProviders>
        <Probe />
      </LazyGameProviders>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);

    mockUseAuth.mockReturnValue(authState(true, true));
    const onRecoverableError = jest.fn();
    act(() => {
      hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='sidecar']")).toBeTruthy();
    container.remove();
  });
});
