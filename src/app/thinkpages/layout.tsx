import { PortalTintSync } from "~/components/providers/PortalTintSync";

/** ThinkPages app scope: sets the ThinkPages tint for the subtree. */
export default function ThinkPagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="thinkpages" className="contents">
      <PortalTintSync />
      {children}
    </div>
  );
}
