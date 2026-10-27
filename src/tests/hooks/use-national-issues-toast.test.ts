/**
 * "View issues" keeps the production base path and lands on the Overview agenda, where issues
 * are listed, and a deadline-free issue list never reads as urgent.
 */
jest.mock("~/lib/base-path", () => ({
  withBasePath: (path: string) => `/projects/ixstates${path}`,
}));
jest.mock("~/trpc/react", () => ({ api: {} }));

import { openIssuesAgenda } from "~/hooks/useNationalIssuesToast";
import { withEnforcedDeadline } from "~/lib/national-issues/deadline-visibility";

it("pushes the agenda URL with the base path and tells the shell", () => {
  const push = jest.spyOn(window.history, "pushState");
  const onPop = jest.fn();
  window.addEventListener("popstate", onPop);
  openIssuesAgenda();
  expect(push).toHaveBeenCalledWith(null, "", "/projects/ixstates/mycountry?focus=agenda");
  expect(onPop).toHaveBeenCalled();
});

it("drops deadlines while enforcement is off", () => {
  const issue = { id: "n-1", deadlineIxTime: 123 };
  expect(withEnforcedDeadline(issue, false).deadlineIxTime).toBeNull();
  expect(withEnforcedDeadline(issue, true).deadlineIxTime).toBe(123);
});
