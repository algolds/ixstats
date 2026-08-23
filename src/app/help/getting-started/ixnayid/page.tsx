import Link from "next/link";
import { Key, Globe, Shield, Refresh as RefreshCw } from "iconoir-react";
import {
  ArticleLayout,
  Section,
  InfoBox,
  WarningBox,
  ContentCard,
} from "../../_components/ArticleLayout";

export default function IxnayIDArticle() {
  return (
    <ArticleLayout
      title="Unified Identity (IxnayID)"
      description="Connect your simulator country profile with the community wiki and interactive maps."
      icon={Key}
      prevLink={{
        href: "/help/getting-started/ixtime",
        label: "The World Clock (IxTime)",
      }}
      nextLink={{ href: "/help/getting-started/navigation", label: "Finding Your Way Around" }}
    >
      <ContentCard>
        <Section title="What is IxnayID?">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            <strong>IxnayID</strong> is the unified authentication service for our simulation
            platform. It serves as your single sign-on key, linking your country profile across all
            sub-services:
          </p>
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              <strong>IxStats Simulator:</strong> Where you manage your nation's laws, budget, and
              resources.
            </li>
            <li>
              <strong>Interactive Maps (IxWorld):</strong> The live geographic database where your
              borders, territories, and dynamic map overlays are plotted.
            </li>
            <li>
              <strong>Community Wiki (IxWiki):</strong> The central database for history, lore, and
              community-edited profiles.
            </li>
          </ul>
          <p className="text-slate-700 dark:text-slate-300">
            By using a single identity, your stats and actions in the simulator automatically sync
            to the maps and community records.
          </p>
        </Section>

        <Section title="Connecting Your Accounts">
          <p className="mb-4 text-slate-700 dark:text-slate-300">
            When onboarding or setting up your country, you will link your existing gaming profiles
            to create your IxnayID connection:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Verification:</strong> You verify ownership of your external nation or account
              using a unique authorization token.
            </li>
            <li>
              <strong>SSO Token:</strong> This token acts as a handshake, verifying your role level
              and country ID without exposing credentials.
            </li>
            <li>
              <strong>Automatic Setup:</strong> Once verified, your country parameters are generated
              from your baseline history.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Managing Connections">
          <InfoBox title="Troubleshooting and Syncing">
            <p className="mb-3">
              If your stats or maps profile ever appears disconnected, follow these steps to
              re-sync:
            </p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                Navigate to your <strong>Account settings</strong> page.
              </li>
              <li>
                Under <strong>Linked Accounts</strong>, look for your IxnayID connection status.
              </li>
              <li>
                Click <strong>Re-authenticate Connection</strong> if the token has expired.
              </li>
              <li>
                Click <strong>Force Sync</strong> to manually refresh borders, wiki lore links, and
                card balances.
              </li>
            </ol>
          </InfoBox>
        </Section>

        <WarningBox title="Security Guidelines">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Shield className="mr-1 inline h-4 w-4 text-amber-500" /> Never share your
              authorization tokens or verification codes with other players or staff.
            </li>
            <li>
              <RefreshCw className="mr-1 inline h-4 w-4 text-emerald-500" /> Profile synchronization
              runs automatically in the background. Manual sync is only required if you updated your
              external stats recently.
            </li>
          </ul>
        </WarningBox>
      </ContentCard>
    </ArticleLayout>
  );
}
