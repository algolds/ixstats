# Sound Assets

Nothing in the app reads a file from this directory. The site's sounds are synthesized Web Audio cues
(Cuelume, `src/lib/sound/cuelume.ts`), so no MP3 files are needed or loaded. `cards/` is kept empty for any recorded
sound a later change may add.

## How the card sounds work

- Only meaningful moments make a sound (`soundCues`): success, error, a destructive confirm, a sheet or dialog
  opening and closing, a Vault reveal, a Halo notification and arriving on a page. There are no hover or press ticks.
- **The pack reveal** (`src/components/cards/reveal/PackReveal.tsx`) plays `soundCues.reveal` when a Rare or rarer
  card turns, and Epic and rarer cards add a light buzz (`playRevealFeedback`, `reveal-feedback.ts`; the rule is
  `revealFeedbackFor` in `src/lib/cards/face/reveal.ts`). The card sheet plays the same when its card turns to the
  back.
- **One switch.** The sound toggle in Settings → Appearance and in Halo (`useSoundSettings`, stored as
  `ixstates:sound-enabled`) mutes every cue, and the in-app Reduce Motion setting mutes them too. The site has no
  haptics setting, so the reveal's buzz follows the sound switch, and Reduce Motion turns it off.

## Adding a recorded sound

A recorded file would need a player of its own: add it beside the cues in `src/lib/sound/cuelume.ts`, so it follows
the same switch and Reduce Motion, and keep it optional (a missing file must fail silently).
