import { BUILTIN_REACTIONS } from "~/lib/thinkpages-forum/reactions";
import { REACTION_ICONS } from "~/components/thinkpages/post/ThinkpagesPostUtils";

describe("forum reaction types", () => {
  it("offers exactly the Dashboard's reactions that have an icon", () => {
    expect([...BUILTIN_REACTIONS].sort()).toEqual(Object.keys(REACTION_ICONS).sort());
  });
});
