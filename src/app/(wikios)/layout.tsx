import { WikiContextProvider } from "~/components/wikios/shared/WikiContext";

export default function WikiosLayout({ children }: { children: React.ReactNode }) {
  return <WikiContextProvider>{children}</WikiContextProvider>;
}
