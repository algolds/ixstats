import { ForumContextProvider } from "~/components/forum/shared/ForumContext";

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return <ForumContextProvider>{children}</ForumContextProvider>;
}
