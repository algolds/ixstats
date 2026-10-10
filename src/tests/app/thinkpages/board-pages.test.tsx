import { isValidElement } from "react";

jest.mock("~/components/thinkpages-forum/board", () => ({ BoardPage: jest.fn() }));

import { BoardPage } from "~/components/thinkpages-forum/board";
import ForumCategoryPage from "~/app/thinkpages/c/[key]/page";
import RealmCategoryPage from "~/app/thinkpages/r/[realm]/[key]/page";

describe("board routes read ?page= and ?sort=", () => {
  it("opens a sitewide board on its page and sort", async () => {
    const page = await ForumCategoryPage({
      params: Promise.resolve({ key: "general" }),
      searchParams: Promise.resolve({ page: "3", sort: "replies" }),
    });
    expect(isValidElement(page) && page.type).toBe(BoardPage);
    expect(isValidElement(page) && page.props).toEqual({
      categoryKey: "general",
      page: 3,
      sort: "replies",
    });
  });

  it("defaults to page 1 sorted by latest activity, ignoring a bad sort", async () => {
    const page = await ForumCategoryPage({
      params: Promise.resolve({ key: "general" }),
      searchParams: Promise.resolve({ sort: "oldest" }),
    });
    expect(isValidElement(page) && page.props).toEqual({
      categoryKey: "general",
      page: 1,
      sort: "latest",
    });
  });

  it("opens a realm board with its realm", async () => {
    const page = await RealmCategoryPage({
      params: Promise.resolve({ realm: "eurth", key: "hub" }),
      searchParams: Promise.resolve({ page: "2", sort: "newest" }),
    });
    expect(isValidElement(page) && page.props).toEqual({
      categoryKey: "hub",
      realm: "eurth",
      page: 2,
      sort: "newest",
    });
  });
});
