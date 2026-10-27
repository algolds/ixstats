import { trailLabel, trailParties, type TrailEvent } from "~/lib/cards/face/trail";

/** A copy's moves, newest first, each with who took part and when. */
export function CopyTrail({ trail }: { trail: TrailEvent[] }) {
  return (
    <ol className="divide-separator divide-y">
      {trail.map((event) => (
        <TrailRow key={event.id} event={event} />
      ))}
    </ol>
  );
}

function TrailRow({ event }: { event: TrailEvent }) {
  const parties = trailParties(event);
  return (
    <li className="flex items-baseline justify-between gap-2 py-1">
      <span className="min-w-0">
        <span className="block">{trailLabel(event.action)}</span>
        {parties && <span className="text-label-secondary block">{parties}</span>}
      </span>
      <time className="text-label-secondary shrink-0" dateTime={event.at.toISOString()}>
        {event.at.toLocaleDateString()}
      </time>
    </li>
  );
}
