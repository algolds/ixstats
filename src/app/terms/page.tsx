import React from "react";
import { type Metadata } from "next";
import Link from "next/link";
import {
  UserCheck,
  Sparkles,
  ShieldAlert,
  Globe2,
  Coins,
  Scale,
  Mail,
  Info,
  AlertTriangle,
} from "lucide-react";
import { LegalDocumentLayout, type LegalSectionItem } from "~/components/legal/LegalDocumentLayout";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";

export const metadata: Metadata = {
  title: "Terms of Service — IxStates",
  description: "Terms of Service and Community Guidelines for the IxStates platform.",
};

const SECTIONS: LegalSectionItem[] = [
  {
    id: "acceptance-eligibility",
    title: "1. Acceptance & Eligibility",
    summary: "Age 16+ requirement and account responsibility",
  },
  {
    id: "intellectual-property",
    title: "2. Content Ownership & Licensing",
    summary: "Dual-layer IP model: Creator ownership and platform engine license",
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable Use & Roleplay Conduct",
    summary: "Fictional geopolitical roleplay vs. zero tolerance for real-world malice",
  },
  {
    id: "third-party-services",
    title: "4. Third-Party Integrations & Disclaimers",
    summary: "Independent status from NationStates, Discord, and Clerk",
  },
  {
    id: "virtual-assets-disclaimers",
    title: "5. Virtual Assets & Simulation Disclaimers",
    summary: "Zero real-world monetary value and warranty limitations",
  },
  {
    id: "termination-governing-law",
    title: "6. Enforcement, Law & Contact",
    summary: "Account termination, US governing jurisdiction, and legal inquiries",
  },
];

export default function TermsOfServicePage() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      subtitle="Welcome to IxStates. These Terms of Service govern your access to and use of the IxStates platform, including MyCountry, Realms, ThinkPages, IxVault, Onoma, Vexel, and WikiOS."
      badge="Legal Terms"
      lastUpdated="August 16, 2026"
      version='1.0 "Ogma"'
      sections={SECTIONS}
    >
      {/* Preamble / Introduction */}
      <CutoutCard
        texture="triangular"
        textureOpacity={0.02}
        className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
      >
        <CutoutCardContent className="text-muted-foreground space-y-3 p-6 text-sm leading-relaxed sm:p-8">
          <p>
            These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) constitute a legally
            binding agreement between you (&ldquo;<strong>User</strong>&rdquo;, &ldquo;
            <strong>Player</strong>&rdquo;, or &ldquo;<strong>Creator</strong>&rdquo;) and the{" "}
            <strong>Ixnay Community and IxWiki Administration</strong> (&ldquo;
            <strong>IxStates</strong>&rdquo;, &ldquo;<strong>we</strong>&rdquo;, &ldquo;
            <strong>us</strong>&rdquo;, or &ldquo;<strong>our</strong>&rdquo;) regarding your access
            to and participation in the digital services, nation simulations, conworlding tools,
            social feeds, and interactive tools available across <code>ixwiki.com</code> and
            affiliated subdomains.
          </p>
          <p>
            By creating an account, accessing the website, claiming a nation, or utilizing any of
            our simulation engines, you acknowledge that you have read, understood, and agree to be
            bound by these Terms and our{" "}
            <Link
              href="/privacy"
              className="font-medium text-amber-600 underline hover:opacity-80 dark:text-amber-400"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </CutoutCardContent>
      </CutoutCard>

      {/* Section 1 */}
      <div id="acceptance-eligibility" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                1. Acceptance &amp; Eligibility
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                You must be at least <strong>16 years old</strong> to use IxStates. You are
                responsible for your account and actions. One person may manage multiple in-game
                nation personas, but automated botting or multi-account game exploits are
                prohibited.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.1 Age Requirement
                </h3>
                <p>
                  You must be at least <strong>sixteen (16) years of age</strong> to create an
                  account, participate in the simulation, or use any features of IxStates. This
                  strict threshold applies across all jurisdictions to ensure compliance with
                  European Union General Data Protection Regulation (GDPR) youth consent rules and
                  United States digital privacy standards. If we learn that an account is operated
                  by a user under 16, we will terminate the account and purge its associated
                  personal data.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.2 Account Security &amp; Credentials
                </h3>
                <p>
                  Authentication is secured via Clerk. You are solely responsible for maintaining
                  the confidentiality of your login credentials and for all activities that occur
                  under your account. You agree to notify us immediately of any unauthorized access
                  or security breach.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.3 In-Game Personas &amp; Multiple Nations
                </h3>
                <p>
                  Players may establish multiple in-game personas, cabinet officials, and diplomatic
                  voices (e.g. within ThinkPages and MyCountry). However, creating automated
                  secondary accounts to exploit market economics, manipulate election engines,
                  artificially inflate card values, or circumvent moderation sanctions is a
                  violation of these Terms.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 2 */}
      <div id="intellectual-property" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                2. Content Ownership &amp; Licensing (Dual-Layer Model)
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                You own the original stories, characters, and flag illustrations you create.
                However, when you use our engines (like Onoma for languages, Vexel for heraldry, or
                MyCountry for stats), IxStates retains a permanent license to keep those simulation
                outputs running on the platform so the shared world doesn&rsquo;t break. Public wiki
                lore is shared under CC-BY-SA 4.0.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.1 Creator-Owned Intellectual Property
                </h3>
                <p>
                  You retain full copyright and all intellectual property ownership rights in and to
                  your original user-generated content (&ldquo;<strong>UGC</strong>&rdquo;),
                  including custom prose, fictional histories, national anthems, character
                  biographies, custom vector flag artwork, and independent worldbuilding you
                  introduce into IxStates.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.2 Platform-Transformed &amp; Generative Engine Assets
                </h3>
                <p>
                  When you utilize IxStates generative engines, algorithmic tools, or simulation
                  processors—including, without limitation, the <strong>Onoma</strong> conlang
                  generator, <strong>Vexel</strong> heraldry &amp; blazon engine,{" "}
                  <strong>UPG</strong> procedural vector map generators, and{" "}
                  <strong>Statecraft</strong> econometric models:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    You grant IxStates a perpetual, irrevocable, worldwide, royalty-free,
                    non-exclusive license to host, execute, index, calculate, reproduce, display,
                    and maintain the resulting computational outputs, phonetic tables, heraldic
                    compositions, and simulation states across our services.
                  </li>
                  <li>
                    This license survives account closure, nation relinquishment, and user data
                    deletion requests, ensuring that historical trade ledgers, linguistic contact
                    trees, and topological map grids remain cohesive and unbroken for the rest of
                    the simulation community.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.3 Creative Commons Public Lore (CC-BY-SA 4.0)
                </h3>
                <p>
                  To foster cooperative worldbuilding and shared historical lore, all publicly
                  published encyclopedia articles on WikiOS and community timeline events are
                  licensed under the{" "}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-amber-600 underline hover:opacity-80 dark:text-amber-400"
                  >
                    Creative Commons Attribution-ShareAlike 4.0 International License (CC-BY-SA 4.0)
                  </a>
                  . Other community members may reference and build upon public canon with proper
                  attribution.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.4 Copyright Infringement &amp; DMCA Takedowns
                </h3>
                <p>
                  We respect intellectual property rights. If you believe your copyrighted work has
                  been uploaded without authorization, please submit a formal DMCA notice to our
                  designated agent at{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-medium text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>{" "}
                  including:
                </p>
                <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
                  <li>Identification of the copyrighted work claimed to be infringed.</li>
                  <li>Identification of the material to be removed and URL location.</li>
                  <li>Your contact information (name, address, email, phone number).</li>
                  <li>
                    A statement of good faith belief and statement under penalty of perjury of your
                    authority to act.
                  </li>
                </ol>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 3 */}
      <div id="acceptable-use" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                3. Acceptable Use &amp; Roleplay Conduct
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                You can roleplay fictional politics, diplomatic rivalries, and dystopian stories in
                character. You cannot engage in real-world hate speech, harassment, doxxing, or
                illegal behavior out of character. Keep real-world malice out of the game.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  3.1 In-Character (IC) Geopolitical Fiction
                </h3>
                <p>
                  IxStates is a political simulation and storytelling platform. Users are encouraged
                  to roleplay diverse governments, ideologies, economic theories, diplomatic
                  tension, and fictional conflicts within established storytelling channels (such as
                  ThinkPages, Directives, and Embassies). Fictional depiction of dystopian
                  governance or adversarial rhetoric in a creative context is permitted when clearly
                  framed as in-game lore.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  3.2 Out-of-Character (OOC) Strict Prohibitions
                </h3>
                <p>
                  The following conduct is strictly prohibited and results in immediate enforcement
                  action:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Hate Speech &amp; Bigotry:</strong> Real-world racism, misogyny,
                    homophobia, transphobia, antisemitism, religious discrimination, or promotion of
                    hate groups.
                  </li>
                  <li>
                    <strong>Harassment &amp; Doxxing:</strong> Targeted stalking, personal attacks
                    against players, or publishing any player&rsquo;s private real-world information
                    without consent.
                  </li>
                  <li>
                    <strong>Illegal &amp; Harmful Content:</strong> Child sexual abuse material
                    (CSAM), non-consensual sexual imagery, encouragement of self-harm, or terrorist
                    propaganda.
                  </li>
                  <li>
                    <strong>Real-World Impersonation:</strong> Impersonating living individuals,
                    government officials, or other players in bad faith.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  3.3 Technical System Integrity
                </h3>
                <p>
                  Users agree not to: (a) conduct unauthorized vulnerability scans or automated
                  denial-of-service (DoS) attacks; (b) scrape private or authenticated data outside
                  approved API rate limits; (c) inject malicious code, SQL scripts, or XSS payloads;
                  or (d) knowingly exploit economic/calculation software bugs to damage the shared
                  game balance.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 4 */}
      <div id="third-party-services" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Globe2 className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                4. Third-Party Integrations &amp; Disclaimers
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                IxStates is an independent community project. We are not owned by or officially
                affiliated with NationStates, Discord, Clerk, or XenForo. We follow all NationStates
                API rules and third-party terms.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  4.1 NationStates API Compliance
                </h3>
                <p>
                  IxStates is an independent hobbyist project and is{" "}
                  <strong>
                    not affiliated with, maintained by, or endorsed by NationStates or NationStates
                    LLC
                  </strong>
                  . Any NationStates card imports, flag proxying, and nation ownership verifications
                  operate in strict compliance with the <em>NationStates API Terms of Use</em>,
                  including rate limiting (≥800ms between requests), descriptive User-Agent headers,
                  and honoring card takedown verification notices.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  4.2 External Accounts (Discord, WikiOS, XenForo)
                </h3>
                <p>
                  Connecting external accounts (such as Discord OAuth or XenForo forum credentials)
                  is subject to the respective third parties&rsquo; terms and privacy policies.
                  IxStates is not responsible for the availability or data practices of external
                  identity providers.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 5 */}
      <div id="virtual-assets-disclaimers" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Coins className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                5. Virtual Assets &amp; Simulation Disclaimers
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                Cards, credits, and in-game currency have zero real-world monetary value. We may
                rebalance game rules, formulas, or stats to improve simulation health. The platform
                is provided &ldquo;as is&rdquo;.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.1 No Real-World Monetary Value
                </h3>
                <p>
                  All virtual currency, credits, IxVault cards, market shares, deck valuations, and
                  in-game commodities are fictional assets solely intended for gameplay
                  entertainment. Virtual items hold <strong>zero real-world financial value</strong>{" "}
                  and cannot be redeemed, sold, or exchanged for fiat currency or real-world goods.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.2 Simulation Updates &amp; Rebalancing
                </h3>
                <p>
                  We continually refine economic algorithms, atomic government synergies,
                  demographic projections, and card mechanics. We reserve the right to modify,
                  adjust, rebalance, or reset simulation parameters at any time without prior notice
                  or compensation.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.3 Warranty Disclaimer &amp; Liability Cap
                </h3>
                <p className="text-muted-foreground/80 bg-muted/30 border-border/50 rounded-lg border p-3 font-mono text-xs tracking-wide uppercase">
                  IXSTATES IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
                  BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. UNDER NO
                  CIRCUMSTANCES SHALL THE IXNAY COMMUNITY, DEVELOPERS, OR ADMINISTRATORS BE LIABLE
                  FOR ANY DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF YOUR
                  USE OF THE PLATFORM.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 6 */}
      <div id="termination-governing-law" className="scroll-mt-24">
        <CutoutCard
          texture="triangular"
          textureOpacity={0.02}
          className="border-border bg-card/60 shadow-xs backdrop-blur-xl"
        >
          <CutoutCardContent className="space-y-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Scale className="h-5 w-5" />
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                6. Enforcement, Governing Law &amp; Inquiries
              </h2>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.1 Administrative Enforcement
                </h3>
                <p>
                  We reserve the right, at our sole discretion, to investigate suspected violations
                  of these Terms, issue warnings, mute in-game communications, archive or relinquish
                  nation states, reset exploited stats, or permanently ban accounts.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.2 Governing Law &amp; Jurisdiction
                </h3>
                <p>
                  These Terms are governed by and construed in accordance with the laws of the
                  United States. Any disputes arising under these Terms shall be resolved through
                  good-faith discussion with community administration.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.3 Modifications to Terms
                </h3>
                <p>
                  We may revise these Terms from time to time. The &ldquo;Effective Date&rdquo; at
                  the top of this document will reflect the latest version. Continued use of
                  IxStates following notice of changes constitutes your acceptance of the revised
                  Terms.
                </p>
              </div>

              <div className="border-border/80 bg-muted/30 mt-4 flex items-center gap-3 rounded-xl border p-4">
                <Mail className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="text-muted-foreground text-xs">
                  For questions, legal notices, or DMCA communications, please contact the
                  administration at{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-semibold text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>
                  .
                </div>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>
    </LegalDocumentLayout>
  );
}
