import { WikiContextProvider } from "~/components/wikios/shared/WikiContext";
import { WikiDIPlugin } from "~/components/DynamicIsland/plugins/WikiDIPlugin";

export default function WikiosLayout({ children }: { children: React.ReactNode }) {
  return (
    <WikiContextProvider>
      <WikiDIPlugin />
      {children}
    </WikiContextProvider>
  );
}
