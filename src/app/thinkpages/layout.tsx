import { PortalTintSync } from "~/components/providers/PortalTintSync";
import "~/styles/thinkpages-forum.css";

/** ThinkPages app scope: sets the ThinkPages tint for the subtree. */
export default function ThinkPagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="thinkpages" className="contents">
      <PortalTintSync />
      {children}
    </div>
  );
}
