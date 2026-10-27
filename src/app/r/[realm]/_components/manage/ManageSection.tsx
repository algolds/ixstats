import type { RouterOutputs } from "~/trpc/react";

export type RealmManage = RouterOutputs["realms"]["region"]["manage"];

/** One section of a realm's Manage tab, with an anchor for the in-page nav. */
export function ManageSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-separator bg-surface rounded-card scroll-mt-24 border p-4 md:p-6"
    >
      <h2 id={`${id}-title`} className="text-label text-headline">
        {title}
      </h2>
      {description && <p className="text-label-secondary text-footnote mt-1">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
