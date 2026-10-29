/**
 * The server renders WikiOS signed out (the root layout gives Clerk no auth state). A hydration retried after a
 * lazy chunk suspended it runs after Clerk has loaded; the article tabs (and everything else on useWikiAuth) must
 * still match the signed-out HTML, and the signed-in tabs (Edit) follow right after.
 */
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot } from "react-dom/client";

const mockClerk = {
  isLoaded: false,
  isSignedIn: false as boolean | undefined,
  user: null as { id: string; username: string; imageUrl: string } | null,
};
jest.mock("@clerk/nextjs", () => ({ useUser: () => mockClerk }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { WikiArticleTabs } from "~/components/wiki-os/reader/WikiArticleTabs";

function EditPageTabs() {
  const { isSignedIn } = useWikiAuth();
  return <WikiArticleTabs title="Antilles" active="edit" canEdit={isSignedIn} />;
}

const tabLabels = (root: HTMLElement) =>
  [...root.querySelectorAll('[aria-label="Page views"] a')].map((a) => a.textContent);

beforeEach(() => {
  Object.assign(mockClerk, { isLoaded: false, isSignedIn: undefined, user: null });
});

it("hydrates the tabs signed out over signed-out HTML even when Clerk loaded first, then shows Edit", async () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<EditPageTabs />);
  expect(tabLabels(container)).toEqual(["Read", "History", "Talk"]);

  Object.assign(mockClerk, {
    isLoaded: true,
    isSignedIn: true,
    user: { id: "user_1", username: "e2e", imageUrl: "" },
  });
  const onRecoverableError = jest.fn();
  await act(async () => {
    hydrateRoot(container, <EditPageTabs />, { onRecoverableError });
  });

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(tabLabels(container)).toEqual(["Read", "Edit", "History", "Talk"]);
});

it("reports the live user to a component that never hydrated from server HTML", () => {
  Object.assign(mockClerk, {
    isLoaded: true,
    isSignedIn: true,
    user: { id: "user_1", username: "e2e", imageUrl: "https://img" },
  });
  let seen: ReturnType<typeof useWikiAuth> | null = null;
  function Probe() {
    seen = useWikiAuth();
    return null;
  }
  act(() => {
    createRoot(document.createElement("div")).render(<Probe />);
  });
  expect(seen).toEqual({
    isLoaded: true,
    isSignedIn: true,
    user: { id: "user_1", username: "e2e", imageUrl: "https://img" },
  });
});
