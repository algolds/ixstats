"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

export interface NationSwitcherProps {
  /** Called after a successful switch (e.g. to close the menu the switcher sits in). */
  onSwitched?: () => void;
  className?: string;
}

/**
 * The signed-in player's nations, grouped by realm; choosing one makes it the nation they act as
 * (users.setActiveNation). Renders nothing until the player owns at least two nations.
 */
export function NationSwitcher({ onSwitched, className }: NationSwitcherProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data } = api.realms.myNations.useQuery();
  const switchNation = api.users.setActiveNation.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.users.getProfile.invalidate(), utils.realms.myNations.invalidate()]);
      onSwitched?.();
    },
    onError: (error) => notify.error("Could not switch nation", error.message),
  });

  const total = data?.realms.reduce((sum, realm) => sum + realm.nations.length, 0) ?? 0;
  if (!data || total < 2) return null;

  return (
    <nav aria-label="Switch nation" className={className}>
      <div className="text-footnote text-label-secondary px-2.5 pt-1 pb-1">Play as</div>
      {data.realms.map((realm) => (
        <div key={realm.id} role="group" aria-label={realm.name}>
          <div className="text-caption text-label-secondary px-2.5 pt-1">{realm.name}</div>
          {realm.nations.map((nation) => {
            const active = nation.id === data.activeCountryId;
            return (
              <button
                key={nation.id}
                type="button"
                aria-current={active ? "true" : undefined}
                disabled={active || switchNation.isPending}
                onClick={() => switchNation.mutate({ countryId: nation.id })}
                className="text-body text-label hover:bg-fill-4 rounded-control focus-visible:outline-tint flex min-h-9 w-full cursor-pointer items-center gap-3 px-2.5 text-left transition-colors focus-visible:outline-2 disabled:cursor-default disabled:hover:bg-transparent pointer-coarse:min-h-11"
              >
                {nation.flag ? (
                  <img
                    src={nation.flag}
                    alt=""
                    className="border-separator h-4 w-6 shrink-0 rounded-sm border object-cover"
                  />
                ) : (
                  <span className="bg-fill-3 h-4 w-6 shrink-0 rounded-sm" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{nation.name}</span>
                {active && <span className="text-caption text-label-secondary">Active</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
