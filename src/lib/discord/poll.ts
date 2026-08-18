// Discord native-poll payload builder. Shared by the admin poll router and the
// ThinkPages→Discord autopost so both render real, votable Discord polls.
// Limits per https://discord.com/developers/docs/resources/poll
const MAX_QUESTION = 300;
const MAX_ANSWER = 55;
const MAX_ANSWERS = 10;
const MAX_DURATION_HOURS = 768; // 32 days

export interface PollForDiscord {
  question: string;
  multiple: boolean;
  endDate?: Date | null;
  options: { label: string }[];
}

export function buildDiscordPollObject(poll: PollForDiscord) {
  // duration is whole hours from now to endDate, clamped to Discord's bounds.
  let duration = 24;
  if (poll.endDate) {
    const hours = Math.ceil((poll.endDate.getTime() - Date.now()) / 3_600_000);
    duration = Math.min(Math.max(hours, 1), MAX_DURATION_HOURS);
  }
  return {
    question: { text: poll.question.slice(0, MAX_QUESTION) },
    answers: poll.options.slice(0, MAX_ANSWERS).map((o) => ({
      poll_media: { text: o.label.slice(0, MAX_ANSWER) },
    })),
    duration,
    allow_multiselect: poll.multiple,
  };
}
