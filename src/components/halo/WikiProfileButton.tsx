import React from "react";
import { useUser } from "~/context/auth-context";
import { useIxTime } from "~/context/IxTimeContext";
import { PreText } from "~/components/ui/pretext";

interface WikiProfileButtonProps {}

export function WikiProfileButton({}: WikiProfileButtonProps) {
  const { user } = useUser();
  const { ixTimeTimestamp } = useIxTime();

  const getGreeting = (ixTime: number): string => {
    const hour = new Date(ixTime).getUTCHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 21) return "Good evening";
    return "Good night";
  };
  const greeting = `${getGreeting(ixTimeTimestamp)}${user?.firstName ? `, ${user.firstName}` : ""}`;

  return (
    <span className="text-foreground/80 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium select-none">
      {user?.imageUrl ? (
        <img
          src={user.imageUrl}
          alt=""
          className="h-4 w-4 rounded-full object-cover ring-1 ring-white/20"
        />
      ) : (
        <span className="text-muted-foreground h-3 w-3 text-xs">👤</span>
      )}
      <PreText className="hidden text-inherit sm:inline" whiteSpace="nowrap">
        {greeting}
      </PreText>
    </span>
  );
}
