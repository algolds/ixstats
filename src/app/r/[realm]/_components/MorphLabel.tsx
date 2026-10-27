const LABEL =
  "inline-block overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out motion-reduce:transition-none";

/**
 * A button label that shows a nation card's state (`idle`) and morphs into the button's action while the card is
 * hovered or the button has keyboard focus. The state is hidden from assistive tech, so the button is named by
 * its action.
 */
export function MorphLabel({ idle, action }: { idle: string; action: string }) {
  return (
    <span className="inline-flex">
      <span
        aria-hidden="true"
        className={`${LABEL} max-w-40 opacity-100 [.country-focus-card:hover_&]:max-w-0 [.country-focus-card:hover_&]:opacity-0 [button:focus-visible_&]:max-w-0 [button:focus-visible_&]:opacity-0`}
      >
        {idle}
      </span>
      <span
        className={`${LABEL} max-w-0 opacity-0 [.country-focus-card:hover_&]:max-w-40 [.country-focus-card:hover_&]:opacity-100 [button:focus-visible_&]:max-w-40 [button:focus-visible_&]:opacity-100`}
      >
        {action}
      </span>
    </span>
  );
}
