import React from "react";
import { type Metadata } from "next";
import Link from "next/link";
import {
  UserBadgeCheck as UserCheck,
  Sparks as Sparkles,
  ShieldAlert,
  Globe as Globe2,
  Coins,
  ScaleFrameEnlarge as Scale,
  Mail,
  InfoCircle as Info,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { LegalDocumentLayout, type LegalSectionItem } from "~/components/ui/LegalDocumentLayout";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";

export const metadata: Metadata = {
  title: "Terms of Service — IxStates",
  description:
    "Terms of Service and legal agreement governing the IxStates platform and Alpaia Holdings services.",
};

const SECTIONS: LegalSectionItem[] = [
  {
    id: "acceptance-eligibility",
    title: "1. Operator, Scope & Eligibility",
    summary: "Alpaia Holdings, ecosystem scope, 16+ age rule, Clerk auth, and in-game personas",
  },
  {
    id: "intellectual-property",
    title: "2. Intellectual Property & Computational Outputs",
    summary: "Creator ownership, engine operation continuity license, and CC BY-SA 4.0 lore",
  },
  {
    id: "third-party-services",
    title: "3. Third-Party Integrations & API Standards",
    summary: "Independent status from NationStates, Discord, and Clerk with API compliance",
  },
  {
    id: "acceptable-use",
    title: "4. Conduct, Roleplay & Platform Security",
    summary: "Technical abuse, AI scraping bans, in-character geopolitics vs real-world malice",
  },
  {
    id: "virtual-assets-disclaimers",
    title: "5. Virtual Assets, Trademarks & Simulation Disclaimers",
    summary: "Zero real-world monetary value, platform marks, and simulation disclaimers",
  },
  {
    id: "termination-governing-law",
    title: "6. Enforcement, DMCA Safe Harbor & Governing Law",
    summary: "Moderation, DMCA takedowns/counter-notices, liability cap, and NY exclusive venue",
  },
];

export default function TermsOfServicePage() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      subtitle="These Terms of Service constitute a legally binding agreement governing your access to and use of the IxStates platform and all services operated by Alpaia Holdings."
      badge="Legal Terms"
      lastUpdated="August 24, 2026"
      version='1.4.0 "Ogma"'
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
            binding agreement between you (&ldquo;<strong>you</strong>&rdquo;, &ldquo;
            <strong>User</strong>&rdquo;, &ldquo;<strong>Player</strong>&rdquo;, or &ldquo;
            <strong>Creator</strong>&rdquo;) and <strong>Alpaia Holdings</strong>, a New York
            general partnership (&ldquo;<strong>Alpaia Holdings</strong>&rdquo;, &ldquo;
            <strong>Alpaia</strong>&rdquo;, &ldquo;<strong>IxStates</strong>&rdquo;, &ldquo;
            <strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>&rdquo;, or &ldquo;
            <strong>our</strong>&rdquo;).
          </p>
          <p>
            These Terms govern your access to and use of the IxStates platform and the related
            websites, applications, simulations, creative engines, community systems, and services
            operated by Alpaia Holdings, including services made available through{" "}
            <code>ixwiki.com</code> and its affiliated subdomains (collectively, the &ldquo;
            <strong>Services</strong>&rdquo;).
          </p>
          <p>
            By creating an account, accessing or using the Services, claiming or managing an in-game
            nation, submitting content, or participating in the simulation, you acknowledge that you
            have read and understood these Terms and agree to be legally bound by them and our{" "}
            <Link
              href="/privacy"
              className="font-medium text-amber-600 underline hover:opacity-80 dark:text-amber-400"
            >
              Privacy Policy
            </Link>
            . If you do not agree to these Terms, you may not access or use the Services.
          </p>
        </CutoutCardContent>
      </CutoutCard>

      {/* Section 1: Operator, Scope & Eligibility */}
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
                1. Operator, Scope &amp; Eligibility
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                The Services are operated by Alpaia Holdings. You must be at least{" "}
                <strong>16 years old</strong> to use IxStates. You are responsible for your account
                and credentials. You may roleplay multiple fictional nation personas, but exploiting
                multi-accounts for automated game advantages or moderation evasion is strictly
                prohibited.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.1 Legal Operator &amp; Ecosystem Scope
                </h3>
                <p>
                  The Services are operated by <strong>Alpaia Holdings</strong>, a New York general
                  partnership (Email:{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-medium text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>
                  ). &ldquo;IxStates&rdquo; is the platform and service name operated by Alpaia
                  Holdings and is not a separate legal entity unless expressly designated as such.
                </p>
                <p className="mt-2">
                  &ldquo;Ixnay&rdquo; refers to the broader collaborative digital worldbuilding
                  community and creative project administered by Alpaia Holdings. The Services
                  encompass the entire ecosystem, including <strong>IxStates</strong>,{" "}
                  <strong>Realms</strong>, <strong>MyCountry</strong>, <strong>IxWiki / WikiOS</strong>
                  , <strong>ThinkPages</strong>, <strong>ThinkShare</strong>, <strong>IxVault</strong>
                  , <strong>IxWorld</strong> and related GIS mapping systems, <strong>Onoma</strong>,{" "}
                  <strong>Vexel</strong>, <strong>Statecraft</strong>, <strong>UPG</strong>, and
                  affiliated creative tools.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.2 Age Eligibility &amp; Minor Protections
                </h3>
                <p>
                  The Services are intended strictly for individuals{" "}
                  <strong>sixteen (16) years of age or older</strong>. By accessing or using the
                  Services, you represent and warrant that: (a) you are at least 16 years of age; and
                  (b) you possess the legal capacity to enter into these Terms under applicable law.
                  We reserve the right to immediately restrict or terminate accounts operated by
                  individuals who do not satisfy this requirement.
                </p>
                <p className="mt-2">
                  The Services are not directed to children under 13. We do not knowingly collect
                  personal information from children under 13. If we discover that personal
                  information has been collected from a child under 13, we will take immediate steps
                  to delete such data and terminate the account.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.3 Account Security &amp; Credentials
                </h3>
                <p>
                  Authentication is managed through Clerk or other authorized authentication
                  providers. You are solely responsible for maintaining the confidentiality of your
                  credentials, safeguarding linked third-party accounts, and all activity occurring
                  under your account. You agree to notify us immediately at{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-medium text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>{" "}
                  upon discovering any unauthorized access or compromise.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  1.4 Multiple Personas &amp; Anti-Exploit Rules
                </h3>
                <p>
                  IxStates permits a user to operate multiple in-game fictional personas, cabinet
                  members, and diplomatic identities within established storytelling features.
                  These fictional identities do not constitute separate legal persons or distinct
                  user accounts. You may not operate multiple accounts to evade moderation
                  sanctions, artificially manipulate card markets, falsify election engines, exploit
                  economic calculation bugs, or gain unfair technical advantages.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 2: Intellectual Property & Computational Outputs */}
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
                2. Intellectual Property &amp; Computational Outputs
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                You retain copyright in your original stories, characters, and custom flag art.
                However, to prevent the shared world from breaking when players depart, you grant
                Alpaia Holdings a permanent license to keep generated simulation state, procedural
                maps, and economic ledgers running in the shared world. Public wiki lore is governed
                by CC BY-SA 4.0 only where explicitly designated.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.1 Creator-Owned Original Content
                </h3>
                <p>
                  You retain all copyright and intellectual property rights that you independently
                  own in original content you submit to the Services (&ldquo;<strong>User Content</strong>
                  &rdquo;), including custom prose, fictional histories, character narratives,
                  original illustrations, custom vector flags, anthems, and independent
                  worldbuilding documents. Nothing in these Terms transfers ownership of your
                  independently owned creative works to Alpaia Holdings.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.2 Platform Operational License
                </h3>
                <p>
                  When you submit User Content, you grant Alpaia Holdings a non-exclusive, worldwide,
                  royalty-free license to host, store, reproduce, process, transmit, format, adapt,
                  and display that content strictly to the extent reasonably necessary to: (a) operate
                  and deliver the Services; (b) display your content to other users according to your
                  visibility settings; (c) perform backups, moderation, and database migrations; and
                  (d) preserve the functionality and continuity of collaborative projects. This
                  license endures as long as reasonably required for these purposes and subsequent
                  legitimate archival, security, or legal compliance needs.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.3 Simulation, Generative &amp; Computational Outputs (Continuity License)
                </h3>
                <p>
                  The Services utilize algorithmic generators, procedural models, and econometric
                  simulations—including the <strong>Onoma</strong> linguistic generator,{" "}
                  <strong>Vexel</strong> heraldry engine, <strong>UPG</strong> procedural vector map
                  mesh, and <strong>Statecraft</strong> macroeconomic calculations. To the extent
                  your use of the Services generates computational outputs or persistent simulation
                  states incorporated into the shared environment:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    You grant Alpaia Holdings a perpetual, worldwide, royalty-free, non-exclusive
                    license to host, calculate, reproduce, index, display, and maintain such
                    computational outputs, phonetic lexicons, heraldic layouts, trade ledgers, and
                    simulation states.
                  </li>
                  <li>
                    This license survives account closure or nation archiving to ensure that shared
                    historical timelines, topological grids, and multilateral simulation records
                    remain unbroken for the community.
                  </li>
                  <li>
                    We do not warrant that procedural or algorithmic outputs (names, map seeds,
                    heraldic blazons) are unique or exclusive to any single user.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  2.4 Community-Licensed Content (CC BY-SA 4.0)
                </h3>
                <p>
                  Content within IxWiki, WikiOS, or community knowledge repositories that is{" "}
                  <strong>expressly designated</strong> under Creative Commons
                  Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) is governed by the terms of
                  that license. The mere existence of a public page does not automatically place
                  every element under CC BY-SA 4.0 unless expressly designated.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 3: Third-Party Integrations & API Standards */}
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
                3. Third-Party Integrations &amp; API Standards
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                IxStates is an independent community project and is not owned or operated by
                NationStates, Discord, XenForo, or Clerk. We strictly honor NationStates API rate
                limits and proxy rules.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  3.1 Independent Community Project Status
                </h3>
                <p>
                  IxStates is an independent hobbyist project operated by Alpaia Holdings and is{" "}
                  <strong>
                    not affiliated with, endorsed by, sponsored by, or operated by NationStates,
                    NationStates LLC, Discord Inc., XenForo Ltd., or Clerk Inc.
                  </strong>
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  3.2 NationStates Integration &amp; API Compliance
                </h3>
                <p>
                  Certain features permit users to link or reference nation data and cards from
                  NationStates. All such integrations operate in strict compliance with the{" "}
                  <em>NationStates API Terms of Use</em>, including:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5">
                  <li>Enforcing mandatory client rate-limiting (minimum 800ms between requests);</li>
                  <li>
                    Transmitting standardized descriptive User-Agent headers (
                    <code>IxStats-Builder</code>);
                  </li>
                  <li>
                    Routing image requests through secure caching proxies (
                    <code>/api/proxy-ns-image</code>) to prevent unauthorized hotlinking; and
                  </li>
                  <li>Promptly executing card and nation verification takedown notices.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  3.3 External Accounts &amp; Services
                </h3>
                <p>
                  Connecting third-party accounts (such as Discord OAuth or XenForo forum credentials)
                  is subject to those third parties&rsquo; independent terms and privacy policies.
                  Alpaia Holdings does not control and assumes no liability for the availability,
                  uptime, or data handling practices of third-party platforms.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 4: Conduct, Roleplay & Platform Security */}
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
                4. Conduct, Roleplay &amp; Platform Security
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                You are encouraged to roleplay fictional geopolitics, adversarial alliances, and
                dystopian stories in character. You may NEVER engage in real-world hate speech,
                harassment, doxxing, automated attacks, or AI training data scraping out of character.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  4.1 In-Character (IC) Geopolitical Roleplay
                </h3>
                <p>
                  IxStates is a geopolitical simulation and creative worldbuilding platform. Users
                  regularly depict fictional governments, ideologies, political rivalries, economic
                  tensions, revolutions, and dystopian societies within established storytelling
                  canons. Content clearly framed within fictional roleplay is not prohibited merely
                  because it portrays controversial or adversarial fictional concepts.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  4.2 Out-of-Character (OOC) Strict Prohibitions
                </h3>
                <p>
                  Fictional roleplay framing does not protect real-world malice. The following
                  conduct is strictly prohibited across all Services:
                </p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Real-World Hate Speech:</strong> Real-world bigotry, racism, misogyny,
                    homophobia, transphobia, antisemitism, religious hatred, or promotion of violent
                    extremist organizations.
                  </li>
                  <li>
                    <strong>Harassment &amp; Doxxing:</strong> Targeted harassment, stalking,
                    threats of real-world violence, or publishing any individual&rsquo;s private
                    real-world identifying information without express consent.
                  </li>
                  <li>
                    <strong>Unlawful &amp; Exploitative Material:</strong> Child sexual abuse material
                    (CSAM), non-consensual sexual imagery, self-harm encouragement, or terrorism
                    facilitation.
                  </li>
                  <li>
                    <strong>Real-World Impersonation:</strong> Impersonating living private
                    individuals or public figures in bad faith.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  4.3 Platform Security &amp; AI Scraping Restrictions
                </h3>
                <p>You agree not to:</p>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    Conduct unauthorized vulnerability scanning, penetration testing, or automated
                    denial-of-service (DoS) attacks;
                  </li>
                  <li>
                    Inject malicious code, SQL payloads, cross-site scripting (XSS), or automated
                    exploits;
                  </li>
                  <li>
                    Bypass authentication controls, rate limiters, or access unauthorized private
                    data; or
                  </li>
                  <li>
                    Scrape, crawl, harvest, or extract User Content, simulation databases, or
                    linguistic data for the purpose of training machine learning or artificial
                    intelligence models without our prior written consent.
                  </li>
                </ul>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 5: Virtual Assets, Trademarks & Simulation Disclaimers */}
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
                5. Virtual Assets, Trademarks &amp; Simulation Disclaimers
              </h2>
            </div>

            {/* Plain English Callout */}
            <div className="text-muted-foreground flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-xs leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <strong className="text-foreground font-semibold">Plain English Summary:</strong>{" "}
                Cards, credits, and virtual currencies have zero real-world monetary value and
                cannot be redeemed for cash. Simulation figures are fictional and must not be used
                for real-world financial or political decisions.
              </div>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.1 Non-Monetary Virtual Assets
                </h3>
                <p>
                  All in-game currencies, IxVault credits, cards, market shares, deck valuations, and
                  virtual commodities are purely fictional simulation assets. They possess{" "}
                  <strong>zero real-world monetary value</strong> and cannot be redeemed for fiat
                  currency, goods, or real-world services. They do not constitute securities,
                  deposits, financial instruments, or property claims against Alpaia Holdings. We
                  reserve the right to rebalance, modify, or reset virtual asset values as part of
                  ordinary simulation maintenance.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.2 Proprietary Platform Intellectual Property &amp; Trademarks
                </h3>
                <p>
                  Except for User Content, the underlying software, source code, database architectures,
                  interface designs, logos, and proprietary simulation algorithms are owned by or
                  licensed to Alpaia Holdings. &ldquo;IxStates,&rdquo; &ldquo;Ixnay,&rdquo;{" "}
                  &ldquo;IxWiki,&rdquo; &ldquo;WikiOS,&rdquo; &ldquo;Onoma,&rdquo; &ldquo;Vexel,&rdquo;
                  and associated logos are trademarks of Alpaia Holdings. You may not use them
                  without prior written authorization.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.3 Simulation Disclaimers
                </h3>
                <p>
                  The Services simulate fictional economies, governments, demographics, and spatial
                  geographies. Simulation results are not guaranteed to be mathematically optimal,
                  economically sound, or predictive. Simulation figures must not be relied upon for
                  actual financial, legal, political, medical, or real-world decision-making.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  5.4 User Representations &amp; Warranties
                </h3>
                <p>
                  By submitting User Content, you represent and warrant that: (a) you hold all
                  necessary rights and licenses to submit such material; (b) your submission does not
                  infringe or misappropriate any third party&rsquo;s copyright, trademark, privacy, or
                  intellectual property rights; and (c) your content complies with all applicable laws
                  and these Terms.
                </p>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>

      {/* Section 6: Enforcement, DMCA Safe Harbor & Governing Law */}
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
                6. Enforcement, DMCA Safe Harbor &amp; Governing Law
              </h2>
            </div>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.1 Moderation &amp; Administrative Authority
                </h3>
                <p>
                  We reserve the right to investigate suspected violations of these Terms and apply
                  remedies, including: issuing warnings, muting communications, restricting account
                  features, archiving or relinquishing fictional nations, resetting exploited stats,
                  reversing fraudulent transactions, or permanently banning accounts.
                </p>
                <p className="mt-2">
                  Users may submit appeals regarding significant moderation actions to{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-medium text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>
                  . Account suspension or termination does not require destruction of public,
                  anonymized historical simulation records necessary for shared world continuity.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.2 Copyright Complaints, DMCA Notices &amp; Counter-Notices
                </h3>
                <p>
                  If you believe copyrighted material has been used on the Services without
                  authorization, you may submit a formal notification under the Digital Millennium
                  Copyright Act (17 U.S.C. § 512) to our Designated Agent at{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-medium text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>
                  . Valid notices must contain:
                </p>
                <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-xs">
                  <li>
                    A physical or electronic signature of the copyright holder or authorized agent;
                  </li>
                  <li>Identification of the copyrighted work claimed to have been infringed;</li>
                  <li>
                    Identification of the allegedly infringing material and specific URL location;
                  </li>
                  <li>Your contact information (full name, address, telephone number, and email);</li>
                  <li>
                    A statement of good-faith belief that use of the material is unauthorized; and
                  </li>
                  <li>
                    A statement made under penalty of perjury that the information provided is
                    accurate.
                  </li>
                </ol>
                <p className="mt-2 text-xs">
                  If material you posted was removed by mistake or misidentification, you may submit
                  a written counter-notice to the same address complying with 17 U.S.C. § 512(g). In
                  accordance with 17 U.S.C. § 512(i)(1)(A), Alpaia Holdings maintains a policy that
                  provides for the termination, in appropriate circumstances, of accounts held by
                  users who are repeat infringers.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.3 Warranty Disclaimer &amp; Liability Cap
                </h3>
                <p className="text-muted-foreground/90 bg-muted/30 border-border/60 rounded-lg border p-3.5 font-mono text-xs uppercase">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICES ARE PROVIDED &ldquo;AS
                  IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND. ALPAIA
                  HOLDINGS AND ITS GENERAL PARTNERS, ADMINISTRATORS, CONTRACTORS, AND SERVICE
                  PROVIDERS SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                  PUNITIVE DAMAGES.
                </p>
                <p className="text-muted-foreground/90 bg-muted/30 border-border/60 mt-2 rounded-lg border p-3.5 font-mono text-xs uppercase">
                  IN NO EVENT SHALL THE TOTAL AGGREGATE LIABILITY OF ALPAIA HOLDINGS ARISING OUT OF OR
                  RELATING TO THE SERVICES EXCEED THE GREATER OF ONE HUNDRED U.S. DOLLARS ($100.00 USD)
                  OR THE TOTAL AMOUNT PAID BY YOU TO ALPAIA HOLDINGS IN THE TWELVE (12) MONTHS
                  PRECEDING THE CLAIM.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.4 Indemnification
                </h3>
                <p>
                  To the maximum extent permitted by law, you agree to defend, indemnify, and hold
                  harmless Alpaia Holdings, its general partners, officers, administrators, and
                  contractors from and against third-party claims, liabilities, damages, and expenses
                  (including reasonable legal fees) arising from: (a) your material violation of these
                  Terms; (b) your User Content; or (c) your willful misconduct or unlawful use of the
                  Services.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.5 Governing Law, Exclusive Venue &amp; Waivers
                </h3>
                <p>
                  These Terms and any dispute arising under or relating to the Services shall be
                  governed by and construed in accordance with the laws of the{" "}
                  <strong>State of New York</strong>, without giving effect to conflict-of-law
                  principles.
                </p>
                <p className="mt-2">
                  Except for disputes resolved through informal negotiation under Section 6.6 or
                  where prohibited by applicable consumer law, any legal action or proceeding shall
                  be instituted exclusively in the state or federal courts located in{" "}
                  <strong>New York County, State of New York</strong>, and each party irrevocably
                  submits to the personal jurisdiction and venue of such courts.
                </p>
                <p className="mt-2">
                  <strong>Class Action &amp; Jury Waiver:</strong> TO THE FULLEST EXTENT PERMITTED BY
                  LAW, ALL CLAIMS MUST BE BROUGHT IN AN INDIVIDUAL CAPACITY AND NOT AS A CLASS MEMBER
                  OR PLAINTIFF IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING. EACH PARTY WAIVES
                  ANY RIGHT TO A JURY TRIAL.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold sm:text-base">
                  6.6 Informal Dispute Resolution &amp; Contact
                </h3>
                <p>
                  Prior to filing any formal legal claim, you agree to contact us at{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-medium text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>{" "}
                  with a concise written explanation of the dispute and your requested resolution. Both
                  parties agree to negotiate in good faith for at least thirty (30) days before
                  initiating court proceedings.
                </p>
              </div>

              <div className="border-border/80 bg-muted/30 mt-6 flex items-center gap-3 rounded-xl border p-4">
                <Mail className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="text-muted-foreground text-xs leading-relaxed">
                  <strong>Legal Notices &amp; Inquiries:</strong> Alpaia Holdings / IxStates &bull;{" "}
                  <a
                    href="mailto:admin@ixwiki.com"
                    className="font-semibold text-amber-600 underline dark:text-amber-400"
                  >
                    admin@ixwiki.com
                  </a>
                </div>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>
      </div>
    </LegalDocumentLayout>
  );
}

