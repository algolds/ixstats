import { PortalTintSync } from "~/components/providers/PortalTintSync";

/** Intelligence & Defense app scope: sets the crimson tint inside MyCountry. */
export default function IntelScopeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="intel" className="contents">
      <PortalTintSync />
      {children}
    </div>
  );
}
