/**
 * The Dashboard's single-page sections: which section a dashboard URL opens.
 */
import {
  DASHBOARD_SECTION_PATHS,
  DASHBOARD_SECTION_TITLES,
  getDashboardSection,
} from "~/lib/dashboard-sections";

describe("getDashboardSection", () => {
  it.each([
    ["/dashboard", "home"],
    ["/dashboard/", "home"],
    ["/dashboard/accounts", "accounts"],
    ["/dashboard/accounts/", "accounts"],
    ["/dashboard/accountsx", "home"],
    ["/dashboard/post/x", "home"],
    ["/dashboard/profile/someone", "home"],
    ["/dashboard/saved", "home"],
  ])("%s opens %s", (pathname, section) => {
    expect(getDashboardSection(pathname)).toBe(section);
  });

  it("names each section's path and title", () => {
    expect(DASHBOARD_SECTION_PATHS).toEqual({
      home: "/dashboard",
      accounts: "/dashboard/accounts",
    });
    expect(DASHBOARD_SECTION_TITLES).toEqual({ home: "Dashboard", accounts: "Accounts" });
  });
});

describe("getDashboardSection under a base path", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_PATH = previous;
  });

  it("strips the production base path before reading the section", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    let read: typeof getDashboardSection = () => "home";
    await jest.isolateModulesAsync(async () => {
      ({ getDashboardSection: read } = await import("~/lib/dashboard-sections"));
    });
    expect(read("/projects/ixstates/dashboard/accounts")).toBe("accounts");
    expect(read("/projects/ixstates/dashboard")).toBe("home");
  });
});
