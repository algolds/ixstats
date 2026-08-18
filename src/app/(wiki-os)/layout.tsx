import { WikiDIPlugin } from "~/components/halo/plugins/WikiDIPlugin";

export default function WikiosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WikiDIPlugin />
      {children}
    </>
  );
}
