import { buildPollPayload } from "./post-to-discord";

describe("buildPollPayload", () => {
  it("clamps duration, truncates fields, and caps answers", () => {
    const p = buildPollPayload({
      question: "Q".repeat(400),
      description: "desc",
      multiple: true,
      endDate: new Date(Date.now() + 365 * 24 * 3_600_000), // 1 year out
      options: Array.from({ length: 12 }, (_, i) => ({ label: `O${i}`.repeat(40) })),
    });
    expect(p.poll.question.text.length).toBe(300);
    expect(p.poll.answers.length).toBe(10);
    expect(p.poll.answers[0]!.poll_media.text.length).toBe(55);
    expect(p.poll.duration).toBe(768); // clamped to Discord max
    expect(p.poll.allow_multiselect).toBe(true);
  });

  it("defaults duration to 24h when no endDate", () => {
    expect(buildPollPayload({ question: "Q", multiple: false, options: [] }).poll.duration).toBe(24);
  });
});
