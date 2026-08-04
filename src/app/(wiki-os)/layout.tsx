import { WikiDIPlugin } from "~/components/DynamicIsland/plugins/WikiDIPlugin";


export default function WikiosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WikiDIPlugin />
      {children}
    </>
  );
}
