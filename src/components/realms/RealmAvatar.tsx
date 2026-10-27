import { Globe } from "iconoir-react";
import { assetUrl } from "~/lib/base-path";
import { cn } from "~/lib/utils";

/**
 * A realm's thumbnail, or a globe when it has none. Realm images load without a referrer, like every realm image:
 * community hosts behind hotlink protection (eurth.org) answer 403 to another site's referrer.
 */
export function RealmAvatar({
  thumbnail,
  className,
}: {
  thumbnail: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-separator bg-fill-3 rounded-row flex size-10 shrink-0 items-center justify-center overflow-hidden border",
        className
      )}
    >
      {thumbnail ? (
        <img
          src={assetUrl(thumbnail) ?? ""}
          referrerPolicy="no-referrer"
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <Globe className="text-label-secondary size-5" aria-hidden="true" />
      )}
    </div>
  );
}
