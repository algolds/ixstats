import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { WikiSearchDropdown } from "~/components/halo/plugins/wiki/components/WikiSearchDropdown";

const HOSTILE_SNIPPET = "<img src=x onerror=alert(1)> Burgundie is a <b>kingdom</b>";

jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      advancedSearch: {
        useQuery: () => ({
          isFetching: false,
          data: {
            totalHits: 1,
            results: [{ title: "Burgundie", snippet: HOSTILE_SNIPPET }],
          },
        }),
      },
    },
  },
}));

describe("WikiSearchDropdown snippets (plan 401 S3)", () => {
  it("renders a search snippet as text, never as HTML", () => {
    const { container } = render(
      <WikiSearchDropdown searchQuery="Burg" onSearchChange={jest.fn()} onSelectArticle={jest.fn()} />
    );

    expect(screen.getByText(HOSTILE_SNIPPET)).toBeInTheDocument();
    expect(container.querySelector("img, b")).toBeNull();
  });
});
