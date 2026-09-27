import React, { useEffect } from "react";
import { render, screen } from "@testing-library/react";
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
});
