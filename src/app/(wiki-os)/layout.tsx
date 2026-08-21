import { WikiHalo } from "~/components/halo/plugins";

export default function WikiosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WikiHalo />
      {children}
    </>
  );
}
