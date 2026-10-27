/**
 * The server renders signed out (the root layout gives Clerk no auth state). A hydration that runs after Clerk has
 * loaded (late, or retried after a suspended pass) must still match that HTML, and the user follows right after.
 */
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

const mockClerk = { isLoaded: false, isSignedIn: false, user: null as { id: string } | null };
jest.mock("@clerk/nextjs", () => ({
  useUser: () => mockClerk,
  useAuth: () => ({ signOut: jest.fn(), getToken: jest.fn() }),
  SignInButton: () => null,
  SignOutButton: () => null,
  SignUpButton: () => null,
  UserButton: () => null,
}));
jest.mock("~/components/settings/IxnayIDCard", () => ({ IxnayIDCard: () => null }));
jest.mock("~/lib/logging", () => ({ initConsoleCapture: jest.fn() }));

import { ClerkAuthProvider, useUser } from "~/context/auth-context";

function Who() {
  const { user, isLoaded } = useUser();
  return <span>{`${user ? "in" : "out"}:${isLoaded}`}</span>;
}

it("hydrates signed out over signed-out HTML even when Clerk loaded first, then shows the user", async () => {
  const tree = (
    <ClerkAuthProvider>
      <Who />
    </ClerkAuthProvider>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  expect(container.textContent).toBe("out:false");

  Object.assign(mockClerk, { isLoaded: true, isSignedIn: true, user: { id: "user_1" } });
  const onRecoverableError = jest.fn();
  await act(async () => {
    hydrateRoot(container, tree, { onRecoverableError });
  });

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(container.textContent).toBe("in:true");
});
