import type { ReactNode } from "react";

export function ConsentManagerProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default ConsentManagerProvider;
