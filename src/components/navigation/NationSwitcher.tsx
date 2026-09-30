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
      <div className="text-muted-foreground px-4 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase">
        Play as
      </div>
      {data.realms.map((realm) => (
        <div key={realm.id} role="group" aria-label={realm.name}>
          <div className="text-muted-foreground/80 px-4 pt-1 text-[11px] font-medium">
            {realm.name}
          </div>
          {realm.nations.map((nation) => {
            const active = nation.id === data.activeCountryId;
            return (
              <button
                key={nation.id}
                type="button"
                aria-current={active ? "true" : undefined}
                disabled={active || switchNation.isPending}
                onClick={() => switchNation.mutate({ countryId: nation.id })}
                className="text-foreground/80 hover:bg-accent/10 hover:text-foreground flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm transition-colors disabled:cursor-default disabled:hover:bg-transparent"
              >
                {nation.flag ? (
                  <img
                    src={nation.flag}
                    alt=""
                    className="border-border h-4 w-6 shrink-0 rounded-sm border object-cover"
                  />
                ) : (
                  <span className="bg-muted h-4 w-6 shrink-0 rounded-sm" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{nation.name}</span>
                {active && <span className="text-muted-foreground text-xs">Active</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
