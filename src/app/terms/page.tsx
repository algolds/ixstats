import { type Metadata } from "next";
import { DocumentPage } from "~/components/documents/DocumentPage";

export const metadata: Metadata = {
  title: "Terms of Service — IxStates",
  description:
    "Terms of Service and legal agreement governing the IxStates platform and Alpaia Holdings services.",
};

export default function TermsOfServicePage() {
  return <DocumentPage file="legal/terms.md" back={{ href: "/", label: "Home" }} />;
}
