// The /util/* pages use wikios-* classes but sit outside the /wiki layout that loads the stylesheet.

import "~/styles/wiki-os.css";

export default function WikiOSUtilLayout({ children }: { children: React.ReactNode }) {
  return children;
}
