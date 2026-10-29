/**
 * A ThinkPages post with a content warning shows "CW: <reason>" and a "Show post" button, and its body stays out of
 * the page until the button is pressed. PostHtml's spoilers keep their button semantics once WikiHtmlContent has
 * rebuilt the HTML as elements, and reveal on click.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContentWarningGate } from "~/components/thinkpages/post/ContentWarningGate";
import { PostHtml } from "~/components/thinkpages/post/PostHtml";
import { SPOILER_LABEL } from "~/lib/thinkpages/spoilers";

jest.mock("~/trpc/react", () => ({
  api: { wikios: { getMissingPages: { useQuery: () => ({ data: undefined }) } } },
}));

describe("ContentWarningGate", () => {
  it("hides the post behind its warning until Show post is pressed", () => {
    const outer = jest.fn();
    render(
      <div onClick={outer}>
        <ContentWarningGate reason="war violence">
          <p>the body</p>
        </ContentWarningGate>
      </div>
    );
    expect(screen.getByText("CW: war violence")).toBeInTheDocument();
    expect(screen.queryByText("the body")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show post" }));
    expect(screen.getByText("the body")).toBeInTheDocument();
    expect(screen.queryByText("CW: war violence")).toBeNull();
    // The post card underneath would open the post.
    expect(outer).not.toHaveBeenCalled();
  });

  it.each([[null], [undefined], [""]])(
    "renders the post as it is with no warning (%p)",
    (reason) => {
      render(
        <ContentWarningGate reason={reason}>
          <p>the body</p>
        </ContentWarningGate>
      );
      expect(screen.getByText("the body")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Show post" })).toBeNull();
    }
  );
});

describe("PostHtml spoilers", () => {
  it("keeps the spoiler a button after mount and reveals it on click", async () => {
    const outer = jest.fn();
    render(
      <div onClick={outer}>
        <PostHtml content="a ||secret|| b" />
      </div>
    );
    const spoiler = await waitFor(() => screen.getByRole("button", { name: SPOILER_LABEL }));
    expect(spoiler).toHaveAttribute("tabindex", "0");
    expect(spoiler).toHaveAttribute("data-spoiler");

    fireEvent.click(spoiler);
    expect(spoiler).toHaveAttribute("data-revealed");
    expect(spoiler).not.toHaveAttribute("role");
    expect(screen.queryByRole("button", { name: SPOILER_LABEL })).toBeNull();
    expect(outer).not.toHaveBeenCalled();
  });
});
