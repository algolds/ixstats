import Link from "next/link";
import { cn } from "~/lib/utils";

/** The article's lead image as a link thumbnail; it hides itself if the image fails to load. */
export function WikiLeadThumb({
  image,
  href,
  title,
  className,
}: {
  image: string;
  href: string;
  title: string;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border-separator bg-fill-4 rounded-row focus-visible:outline-tint relative h-20 w-28 shrink-0 overflow-hidden border focus-visible:outline-2 focus-visible:outline-offset-2",
        className
      )}
      title={`View ${title}`}
    >
      <img
        src={image}
        alt={title}
        className="h-full w-full object-cover"
        onError={(e) => {
          (e.target as HTMLElement).style.display = "none";
        }}
      />
    </Link>
  );
}
