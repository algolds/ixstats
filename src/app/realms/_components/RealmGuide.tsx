import Link from "next/link";
import { Card } from "~/components/ui/card";

/** The help article the guide summarises. */
export const REALM_GUIDE_HREF = "/help/world/realms";

const STEPS = [
  {
    title: "Pick your region",
    body: "A realm works like a region: its own map, founder, officers and roleplay.",
  },
  {
    title: "Claim your nation",
    body: "Take an unclaimed nation, or the one whose wiki page you already wrote.",
  },
  {
    title: "Govern and post",
    body: "Answer your nation's issues, then talk to your neighbours on the realm board, its RMB.",
  },
];

/** How realms work in three steps, for the rail, with the way to the full help article. */
export function RealmGuide() {
  return (
    <Card
      content="navigation"
      padding="md"
      aria-labelledby="realm-guide-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="realm-guide-heading" className="text-label text-headline">
        Realm guide
      </h2>
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="facet-well text-tint text-footnote flex size-6 shrink-0 items-center justify-center rounded-full font-semibold tabular-nums"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-label text-body font-medium">{step.title}</p>
              <p className="text-label-secondary text-footnote">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href={REALM_GUIDE_HREF} className="text-label text-footnote hover:underline">
        Read the full guide
      </Link>
    </Card>
  );
}
