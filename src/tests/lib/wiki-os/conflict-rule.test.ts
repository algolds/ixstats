/** @jest-environment node */
/**
 * The conflict rule: the later save wins on both wikis (whole seconds, a tie to classic), the verdict is the same from
 * either side, and every distinct overwritten author gets the channels their identity allows.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findUnique: jest.fn() } },
}));

import {
  conflictKey,
  decideCollision,
  laterChange,
  noticeRecipients,
  trailSummary,
  type ChangeAction,
  type ChangeAuthor,
  type CollisionInput,
  type PageChange,
  type WikiSide,
} from "~/lib/wiki-os/services/conflict-rule";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const NO_AUTHOR: ChangeAuthor = { userId: null, classicName: null, ip: null, label: null };

function change(
  side: WikiSide,
  ref: string,
  at: string,
  author: Partial<ChangeAuthor> = {},
  action: ChangeAction = "edit"
): PageChange {
  return { side, action, ref, at: new Date(at), author: { ...NO_AUTHOR, ...author } };
}

function mirrored(input: CollisionInput): CollisionInput {
  return {
    incoming: input.standing,
    standing: input.incoming,
    incomingBranch: input.standingBranch,
    standingBranch: input.incomingBranch,
  };
}

describeEachWikiosMode("conflict rule", () => {
  describe("laterChange", () => {
    it("gives a same-second tie to classic even when WikiOS has later milliseconds", () => {
      const wikios = change("wikios", "cmwk10", "2026-10-24T12:00:05.900Z");
      const classic = change("classic", "11", "2026-10-24T12:00:05.000Z");
      expect(laterChange(wikios, classic)).toBe(classic);
      expect(laterChange(classic, wikios)).toBe(classic);
    });

    it("lets WikiOS win from the next whole second", () => {
      const wikios = change("wikios", "cmwk10", "2026-10-24T12:00:06.100Z");
      const classic = change("classic", "11", "2026-10-24T12:00:05.000Z");
      expect(laterChange(wikios, classic)).toBe(wikios);
      expect(laterChange(classic, wikios)).toBe(wikios);
    });

    it("lets a later classic save win", () => {
      const wikios = change("wikios", "cmwk10", "2026-10-24T12:00:05.000Z");
      const classic = change("classic", "11", "2026-10-24T12:00:09.000Z");
      expect(laterChange(wikios, classic)).toBe(classic);
    });

    it("compares all-digit refs on one side numerically, so 100 is later than 99", () => {
      const a = change("classic", "99", "2026-10-24T12:00:05.100Z");
      const b = change("classic", "100", "2026-10-24T12:00:05.700Z");
      expect(laterChange(a, b)).toBe(b);
      expect(laterChange(b, a)).toBe(b);
    });

    it("breaks a same-second tie on one side by ref, whichever order they arrive in", () => {
      const first = change("wikios", "a", "2026-10-24T12:00:05.100Z");
      const second = change("wikios", "b", "2026-10-24T12:00:05.700Z");
      expect(laterChange(first, second)).toBe(second);
      expect(laterChange(second, first)).toBe(second);
    });
  });

  describe("decideCollision", () => {
    const wikiosBranch = [
      change("wikios", "cmwk100", "2026-10-24T12:00:01Z", { userId: "u1" }),
      change("wikios", "cmwk101", "2026-10-24T12:00:02Z", { userId: "u2" }),
    ];
    const classicEdit = change("classic", "200", "2026-10-24T12:00:09Z", { classicName: "Foo" });

    it("overwrites the whole WikiOS branch when classic is later", () => {
      const input: CollisionInput = {
        incoming: classicEdit,
        standing: wikiosBranch[1]!,
        incomingBranch: [classicEdit],
        standingBranch: wikiosBranch,
      };
      const verdict = decideCollision("ixwiki", "Main_Page", input);
      expect(verdict.winner).toBe(classicEdit);
      expect(verdict.incomingWins).toBe(true);
      expect(verdict.overwritten).toEqual(wikiosBranch);
      expect(verdict.key).toBe("ixwiki:Main_Page:200");
      expect(verdict.key).toBe(conflictKey("ixwiki", "Main_Page", "200"));
    });

    it("overwrites the classic branch when WikiOS is later", () => {
      const laterWikios = change("wikios", "cmwk102", "2026-10-24T12:01:00Z", { userId: "u1" });
      const input: CollisionInput = {
        incoming: laterWikios,
        standing: classicEdit,
        incomingBranch: [...wikiosBranch, laterWikios],
        standingBranch: [classicEdit],
      };
      const verdict = decideCollision("ixwiki", "Main_Page", input);
      expect(verdict.winner).toBe(laterWikios);
      expect(verdict.incomingWins).toBe(true);
      expect(verdict.overwritten).toEqual([classicEdit]);
    });

    it("is action-agnostic: a delete after an edit wins, and an edit after a delete wins", () => {
      const edit = change("wikios", "cmwk100", "2026-10-24T12:00:01Z", { userId: "u1" });
      const del = change("classic", "mwlog:7", "2026-10-24T12:00:05Z", { classicName: "Foo" }, "delete");
      const deleteWins = decideCollision("ixwiki", "A", {
        incoming: del,
        standing: edit,
        incomingBranch: [del],
        standingBranch: [edit],
      });
      expect(deleteWins.winner).toBe(del);
      expect(deleteWins.overwritten).toEqual([edit]);

      const wikiosDelete = change("wikios", "log:3", "2026-10-24T12:00:01Z", { userId: "u1" }, "delete");
      const classicEditAfter = change("classic", "300", "2026-10-24T12:00:05Z", { classicName: "Foo" });
      const editWins = decideCollision("ixwiki", "A", {
        incoming: classicEditAfter,
        standing: wikiosDelete,
        incomingBranch: [classicEditAfter],
        standingBranch: [wikiosDelete],
      });
      expect(editWins.winner).toBe(classicEditAfter);
      expect(editWins.overwritten).toEqual([wikiosDelete]);
    });

    it("covers moves and undeletes the same way", () => {
      const move = change("wikios", "log:9", "2026-10-24T12:00:01Z", { userId: "u1" }, "move");
      const undelete = change("classic", "mwlog:2", "2026-10-24T12:00:30Z", { classicName: "Foo" }, "undelete");
      const verdict = decideCollision("ixwiki", "A", {
        incoming: undelete,
        standing: move,
        incomingBranch: [undelete],
        standingBranch: [move],
      });
      expect(verdict.winner).toBe(undelete);
      expect(verdict.overwritten).toEqual([move]);
    });

    it("gives the same winner, overwritten list and key whichever side is incoming", () => {
      const cases: CollisionInput[] = [
        {
          incoming: classicEdit,
          standing: wikiosBranch[1]!,
          incomingBranch: [classicEdit],
          standingBranch: [...wikiosBranch].reverse(),
        },
        {
          incoming: wikiosBranch[1]!,
          standing: change("classic", "201", "2026-10-24T12:00:02.500Z", { classicName: "Bar" }),
          incomingBranch: wikiosBranch,
          standingBranch: [change("classic", "201", "2026-10-24T12:00:02.500Z", { classicName: "Bar" })],
        },
      ];
      cases.push({
        incoming: change("wikios", "cmwk77", "2026-10-24T12:00:05.900Z", { userId: "u1" }),
        standing: change("classic", "88", "2026-10-24T12:00:05.100Z", { classicName: "Bar" }),
        incomingBranch: [change("wikios", "cmwk77", "2026-10-24T12:00:05.900Z", { userId: "u1" })],
        standingBranch: [change("classic", "88", "2026-10-24T12:00:05.100Z", { classicName: "Bar" })],
      });
      for (const input of cases) {
        const forward = decideCollision("ixwiki", "A", input);
        const backward = decideCollision("ixwiki", "A", mirrored(input));
        expect(backward.winner.ref).toBe(forward.winner.ref);
        expect(backward.overwritten.map((c) => c.ref)).toEqual(forward.overwritten.map((c) => c.ref));
        expect(backward.key).toBe(forward.key);
        expect(backward.incomingWins).toBe(!forward.incomingWins);
      }
    });

    it("lists each overwritten change once, oldest first", () => {
      const a = change("wikios", "cmwk1", "2026-10-24T12:00:01Z", { userId: "u1" });
      const b = change("wikios", "cmwk2", "2026-10-24T12:00:02Z", { userId: "u1" });
      const win = change("classic", "9", "2026-10-24T12:00:09Z", { classicName: "Foo" });
      const verdict = decideCollision("ixwiki", "A", {
        incoming: win,
        standing: b,
        incomingBranch: [win],
        standingBranch: [b, a, b],
      });
      expect(verdict.overwritten.map((c) => c.ref)).toEqual(["cmwk1", "cmwk2"]);
    });

    it("gives a same-second collision to classic from either side, with one key", () => {
      const wikios = change("wikios", "cmwk77", "2026-10-24T12:00:05.900Z", { userId: "u1" });
      const classic = change("classic", "88", "2026-10-24T12:00:05.100Z", { classicName: "Bar" });
      const input: CollisionInput = {
        incoming: wikios,
        standing: classic,
        incomingBranch: [wikios],
        standingBranch: [classic],
      };
      const forward = decideCollision("ixwiki", "A", input);
      const backward = decideCollision("ixwiki", "A", mirrored(input));
      expect(forward.winner).toBe(classic);
      expect(backward.winner).toBe(classic);
      expect(forward.overwritten).toEqual([wikios]);
      expect(forward.key).toBe("ixwiki:A:88");
      expect(backward.key).toBe(forward.key);
    });

    it("never lists a ref that the winning branch also holds, and its author is not a recipient", () => {
      const shared = change("wikios", "cmwk5", "2026-10-24T12:00:01Z", { userId: "u-shared" });
      const own = change("wikios", "cmwk6", "2026-10-24T12:00:02Z", { userId: "u-own" });
      const winner = change("classic", "300", "2026-10-24T12:00:09Z", { classicName: "Foo" });
      const verdict = decideCollision("ixwiki", "A", {
        incoming: winner,
        standing: own,
        incomingBranch: [shared, winner],
        standingBranch: [shared, own],
      });
      expect(verdict.overwritten.map((c) => c.ref)).toEqual(["cmwk6"]);
      expect(noticeRecipients(verdict.overwritten).map((r) => r.key)).toEqual(["user:u-own"]);
    });

    it("always lists the losing head, even when the caller passes an empty losing branch", () => {
      const loser = change("wikios", "cmwk8", "2026-10-24T12:00:01Z", { userId: "u1" });
      const winner = change("classic", "400", "2026-10-24T12:00:09Z", { classicName: "Foo" });
      const forward = decideCollision("ixwiki", "A", {
        incoming: winner,
        standing: loser,
        incomingBranch: [winner],
        standingBranch: [],
      });
      expect(forward.overwritten).toEqual([loser]);
      const backward = decideCollision("ixwiki", "A", {
        incoming: loser,
        standing: winner,
        incomingBranch: [],
        standingBranch: [winner],
      });
      expect(backward.overwritten).toEqual([loser]);
      expect(trailSummary(forward, "ab12cd")).not.toMatch(/nothing/i);
    });

    it("orders overwritten changes of one second numerically for all-digit refs", () => {
      const at = "2026-10-24T12:00:01Z";
      const a = change("classic", "99", at, { classicName: "Foo" });
      const b = change("classic", "100", at, { classicName: "Foo" });
      const winner = change("wikios", "cmwk9", "2026-10-24T12:00:09Z", { userId: "u1" });
      const verdict = decideCollision("ixwiki", "A", {
        incoming: winner,
        standing: b,
        incomingBranch: [winner],
        standingBranch: [b, a],
      });
      expect(verdict.overwritten.map((c) => c.ref)).toEqual(["99", "100"]);
    });
  });

  describe("noticeRecipients", () => {
    it("merges two revisions by one user into one recipient with both refs", () => {
      const recipients = noticeRecipients([
        change("wikios", "cmwk1", "2026-10-24T12:00:01Z", { userId: "u1" }),
        change("wikios", "cmwk2", "2026-10-24T12:00:02Z", { userId: "u1" }),
      ]);
      expect(recipients).toEqual([
        {
          key: "user:u1",
          userId: "u1",
          classicName: null,
          ip: null,
          channels: ["in-app", "discord"],
          refs: ["cmwk1", "cmwk2"],
        },
      ]);
    });

    it("sends a classic name and an IP the talk-page note only", () => {
      const recipients = noticeRecipients([
        change("classic", "5", "2026-10-24T12:00:01Z", { classicName: "Foo" }),
        change("classic", "6", "2026-10-24T12:00:02Z", { ip: "203.0.113.4" }),
      ]);
      expect(recipients.map((r) => [r.key, r.channels])).toEqual([
        ["name:Foo", ["talk-page"]],
        ["ip:203.0.113.4", ["talk-page"]],
      ]);
    });

    it("gives a WikiOS user with a claimed classic name all three channels", () => {
      const [recipient] = noticeRecipients([
        change("wikios", "cmwk1", "2026-10-24T12:00:01Z", { userId: "u1", classicName: "Foo" }),
      ]);
      expect(recipient?.channels).toEqual(["in-app", "discord", "talk-page"]);
      expect(recipient?.classicName).toBe("Foo");
    });

    it("counts the same person once when a classic save and a WikiOS save share a claimed name", () => {
      const recipients = noticeRecipients([
        change("classic", "5", "2026-10-24T12:00:01Z", { classicName: "Foo" }),
        change("wikios", "cmwk1", "2026-10-24T12:00:02Z", { userId: "u1", classicName: "Foo" }),
      ]);
      expect(recipients).toHaveLength(1);
      expect(recipients[0]).toMatchObject({
        key: "user:u1",
        channels: ["in-app", "discord", "talk-page"],
        refs: ["5", "cmwk1"],
      });
    });

    it("omits a system label with no account, name or address, and treats blanks as missing", () => {
      expect(
        noticeRecipients([
          change("wikios", "cmwk1", "2026-10-24T12:00:01Z", { label: "System" }),
          change("classic", "2", "2026-10-24T12:00:02Z", { userId: " ", classicName: "", ip: null, label: "Bot" }),
        ])
      ).toEqual([]);
    });

    it("lists one recipient per distinct author", () => {
      const recipients = noticeRecipients([
        change("wikios", "cmwk1", "2026-10-24T12:00:01Z", { userId: "u1" }),
        change("wikios", "cmwk2", "2026-10-24T12:00:02Z", { userId: "u2" }),
        change("wikios", "cmwk3", "2026-10-24T12:00:03Z", { userId: "u1" }),
      ]);
      expect(recipients.map((r) => [r.key, r.refs])).toEqual([
        ["user:u1", ["cmwk1", "cmwk3"]],
        ["user:u2", ["cmwk2"]],
      ]);
    });

    it("does not repeat a ref for one author", () => {
      const same = change("wikios", "cmwk1", "2026-10-24T12:00:01Z", { userId: "u1" });
      expect(noticeRecipients([same, same])[0]?.refs).toEqual(["cmwk1"]);
    });
  });

  describe("trailSummary", () => {
    function verdictOver(overwritten: PageChange[]): ReturnType<typeof decideCollision> {
      const winner = change("classic", "999", "2026-10-24T13:00:00Z", { classicName: "Winner" });
      return {
        winner,
        overwritten,
        incomingWins: true,
        key: conflictKey("ixwiki", "A", winner.ref),
      };
    }

    it("reads as one sentence for one overwritten revision", () => {
      const text = trailSummary(
        verdictOver([change("classic", "1234", "2026-10-24T12:00:00Z", { classicName: "Foo" })]),
        "ab12cd"
      );
      expect(text).toBe("Overwrote revision 1234 by Foo, saved from the same version (conflict ab12cd)");
    });

    it("names log entries and shortens long lists", () => {
      const many = Array.from({ length: 5 }, (_, i) =>
        change("wikios", `${i + 1}`, "2026-10-24T12:00:00Z", { label: `User ${i + 1}` })
      );
      const text = trailSummary(verdictOver(many), "ab12cd");
      expect(text).toBe(
        "Overwrote revision 1, revision 2, revision 3 and 2 more by User 1, User 2, User 3 and 2 more, saved from the same version (conflict ab12cd)"
      );
      expect(
        trailSummary(verdictOver([change("wikios", "log:4", "2026-10-24T12:00:00Z", { ip: "203.0.113.4" })]), "x")
      ).toBe("Overwrote log entry 4 by 203.0.113.4, saved from the same version (conflict x)");
    });

    it("stays within 480 characters with 60 overwritten refs and long names, with no em dash", () => {
      const many = Array.from({ length: 60 }, (_, i) =>
        change("wikios", `log:${"9".repeat(40)}${i}`, "2026-10-24T12:00:00Z", {
          label: `${"Very long author name — ".repeat(8)}${i}`,
        })
      );
      const text = trailSummary(verdictOver(many), "ab12cd");
      expect(text.length).toBeLessThanOrEqual(480);
      expect(text).toMatch(/^[A-Z]/);
      expect(text).not.toContain("—");
      expect(text.length).toBeGreaterThan(100);
    });

    it("never exceeds 480 characters even for an oversized conflict id", () => {
      const text = trailSummary(
        verdictOver([change("classic", "1", "2026-10-24T12:00:00Z", { classicName: "Foo" })]),
        "z".repeat(1000)
      );
      expect(text).toHaveLength(480);
    });

    it("never says it overwrote nothing, even for a verdict with an empty list", () => {
      expect(trailSummary(verdictOver([]), "ab12cd")).toBe("Overwrote the earlier change, saved from the same version (conflict ab12cd)");
    });
  });
});
