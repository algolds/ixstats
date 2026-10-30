/**
 * The proxy sends non-admins from /admin to `/?error=access_denied`: the home page says why once and
 * takes the parameter out of the address.
 */
import { render } from "@testing-library/react";
import { ACCESS_DENIED_MESSAGE, AccessDeniedNotice } from "~/app/_components/AccessDeniedNotice";

const mockWarning = jest.fn();
let mockSearch = "";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ warning: mockWarning }) }));

beforeEach(() => {
  mockWarning.mockClear();
});

describe("AccessDeniedNotice", () => {
  it("shows the notice and cleans the parameter from the URL", () => {
    mockSearch = "error=access_denied&tab=feed";
    window.history.replaceState(null, "", "/?error=access_denied&tab=feed");

    render(<AccessDeniedNotice />);

    expect(mockWarning).toHaveBeenCalledWith(ACCESS_DENIED_MESSAGE, undefined, {
      id: "admin-access-denied",
    });
    expect(window.location.search).toBe("?tab=feed");
  });

  it("stays quiet without the parameter", () => {
    mockSearch = "";
    window.history.replaceState(null, "", "/");

    render(<AccessDeniedNotice />);

    expect(mockWarning).not.toHaveBeenCalled();
  });
});
