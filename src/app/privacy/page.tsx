import { type Metadata } from "next";
import { DocumentPage } from "~/components/documents/DocumentPage";

export const metadata: Metadata = {
  title: "Privacy Policy — IxStates",
  description: "Privacy Policy and Data Protection practices for the IxStates platform.",
};

export default function PrivacyPolicyPage() {
  return <DocumentPage file="legal/privacy.md" back={{ href: "/", label: "Home" }} />;
}
