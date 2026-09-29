import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { WikiContextProvider, useWikiContext } from "~/components/wiki-os/shared/WikiContext";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <WikiContextProvider>{children}</WikiContextProvider>
);

describe("WikiContext carries the current page's wiki (ruling E-l′)", () => {
  it("records another wiki's page, and falls back to IxWiki for IxWiki pages and on leaving", () => {
    const { result } = renderHook(() => useWikiContext(), { wrapper });
    expect(result.current.articleSource).toBe("ixwiki");

    act(() => result.current.setWikiPage("Portal:Eurth", [], null, "iiwiki"));
    expect(result.current.articleTitle).toBe("Portal:Eurth");
    expect(result.current.articleSource).toBe("iiwiki");

    act(() => result.current.setWikiPage(null, [], null));
    expect(result.current.articleSource).toBe("ixwiki");

    act(() => result.current.setWikiPage("Aurelia", []));
    expect(result.current.articleSource).toBe("ixwiki");
  });
});
