// src/app/labs/onoma/components/shared/onoma-help-data.ts
// Static documentation and guide metadata for the Onoma Help & Brand Walkthrough Modal

import React from "react";
import {
  Compass,
  Type,
  Globe,
  Layers,
  Search,
  Volume2,
  GitBranch,
  Split,
  Binary,
  Bookmark,
  Library,
  Activity,
} from "lucide-react";

export interface WalkthroughStep {
  title: string;
  subtitle: string;
  quote?: string;
  progression?: string;
  description: string;
  features: string[];
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: "Language is a system.",
    subtitle: "From rules to language",
    quote:
      "A good name doesn't come from a dictionary. It comes from the rules that made the dictionary possible.",
    progression: "sound → structure → pattern → vocabulary → culture → history",
    description:
      "Every word in a living language follows invisible rules — which sounds are allowed, how syllables combine, what feels native and what feels foreign. Onoma lets you define those rules, then generates names that follow them naturally.",
    features: [
      "Start with a sound palette and syllable structure. The vocabulary writes itself.",
      "Train on real-world linguistic seeds — Old Norse, Swahili, Classical Latin — or invent from scratch",
      "Hear every name spoken aloud with neural pronunciation to test how it actually sounds",
    ],
  },
  {
    title: "Name everything.",
    subtitle: "Places, people, factions, culture",
    description:
      "Specialized domains for every entity your world needs. Each domain shapes the generator toward the right conventions — geographic toponyms feel different from royal dynasties, and they should.",
    features: [
      "Places: Cities, provinces, nations, rivers, mountains, and architectural landmarks",
      "People: Characters, rulers, noble houses — with 17 species presets from Elven to Draconic",
      "Factions & Culture: Political parties, guilds, taverns, religious orders, cuisines, and sports",
    ],
  },
  {
    title: "Build the language.",
    subtitle: "Workshop, sound shifts, and naming conventions",
    description:
      "Go deeper than names. Feed your own word lists to train a custom language model, simulate centuries of sound change, and compose full naming conventions with gendered titles and patronymics.",
    features: [
      "Workshop: Paste a word list and train a model that generates new words in the same style",
      "Sound Shifts: Age your language — transform a proto-tongue into classical, medieval, and modern forms",
      "Name Sets: Combine prefix, root, and suffix dictionaries into structured full names",
    ],
  },
  {
    title: "Understand the language.",
    subtitle: "Acoustics, grammar, scripts, and your lexicon",
    description:
      "See where your vowels sit on the IPA chart. Define word order and case systems. Design a custom alphabet. Track how words travel between languages. Save everything to your permanent stash.",
    features: [
      "Acoustics & IPA: Visualize your language's vowel space and edit grapheme-to-IPA pronunciation rules",
      "Grammar & Writing: Define sentence structure, build root derivation trees, and design vector glyphs",
      "Stash: A permanent library for every name, dictionary, and lexicon entry you want to keep",
    ],
  },
];

export interface SystemGuideItem {
  id: string;
  title: string;
  subtitle: string;
  pillar: "CREATE" | "STUDIO" | "EXPLORE" | "SYSTEM";
  icon: React.ComponentType<{ className?: string }>;
  formula?: string;
  description: string;
  mechanics: { label: string; detail: string }[];
  proTips: string[];
}

export const SYSTEM_GUIDES: SystemGuideItem[] = [
  // --- CREATE PILLAR ---
  {
    id: "create",
    title: "Create",
    subtitle: "Generate names across worldbuilding domains",
    pillar: "CREATE",
    icon: Compass,
    formula: "Seed Corpus → Markov Model → Phonotactic Filter → Name",
    description:
      "The main generation surface. Pick a domain, choose or train a language model, set your constraints, and generate batches of names that sound like they belong to the same culture. Every card shows IPA transcription and syllable count, and you can hear any name spoken aloud instantly.",
    mechanics: [
      {
        label: "Domain Categories",
        detail:
          "Five specialized domains shape how names are structured: Places (cities, rivers, mountains), People (characters, dynasties), Factions (guilds, political parties, covert orders), Culture (ethnicities, cuisines, sports), and a freeform Sandbox.",
      },
      {
        label: "Cultural Profiles",
        detail:
          "Choose from 13 real-world linguistic families — Latin, Germanic, Celtic, Slavic, Arabic, Persian, Turkic, Indic, East Asian, Austronesian, African, Uralic, or Constructed — to shape the phonetic flavor of every generated name.",
      },
      {
        label: "Species & Creature Presets",
        detail:
          "For People, select from 17 species presets (Elf, Dwarf, Orc, Dragon, Angel, Demon, Fey, and more) that apply dedicated syllable patterns and phonetic profiles.",
      },
    ],
    proTips: [
      "Generate 10–20 names at once and keep the whole batch. Use your top picks for heroes and capitals, and scatter the rest across minor villages, tributary rivers, and background NPCs to build regional linguistic cohesion without extra work.",
      "Match sounds to geography. Coastal and island cultures naturally favor open syllables and flowing consonants (l, r, m, n). Mountain or steppe peoples gravitate toward hard consonant clusters and voiceless stops (k, t, p).",
      "Keep everyday names to 2–3 syllables. Reserve 4–5 syllable names for liturgical deities, ancient ruins, and founding dynasties — the extra length signals historical weight without you explaining it.",
      "Use the freeform Sandbox with custom word seeds when you want the generator to learn from your existing vocabulary instead of a preset cultural profile.",
    ],
  },

  // --- STUDIO PILLAR ---
  {
    id: "workshop",
    title: "Workshop",
    subtitle: "Train a custom language model from your own words",
    pillar: "STUDIO",
    icon: Binary,
    formula: "Your Word List → Trained Model → New Words in the Same Style",
    description:
      "Paste or upload a list of words that define the sound of your language. The Workshop learns the patterns — which letter combinations are common, which are rare, how words begin and end — and generates new words that authentically feel like they belong to the same family.",
    mechanics: [
      {
        label: "Word List Training",
        detail:
          "Paste words directly, upload a text file, or load a saved dictionary from your Stash. The model trains instantly on your corpus.",
      },
      {
        label: "Pattern Depth",
        detail:
          "Controls how much preceding linguistic context the engine retains. Depth 1 creates broad, experimental variation. Depth 2 balances novelty with natural flow. Depth 3 produces faithful structural resonance with your seed language.",
      },
      {
        label: "Save & Reuse",
        detail:
          "Save trained dictionaries to your Stash for use across sessions. Load any saved dictionary back into the Workshop or deploy it directly to the Create generator.",
      },
    ],
    proTips: [
      "Curate, don't dump. A focused list of 35–50 well-chosen words produces a far more distinctive linguistic feel than 500 words scraped from generic fantasy generators.",
      "Blend two real-world source languages (e.g. 60% Old Norse + 40% Finnish) to create a unique hybrid — exactly the technique Tolkien used to create the Elvish tongues.",
      "Use Pattern Depth to tune linguistic cohesion. Depth 2 is the recommended sweet spot for most conlangs — generating novel words that sound natively authentic to your input corpus without merely reproducing it.",
      "Train separate models for different social registers: one corpus for peasant speech, another for courtly language, a third for religious liturgy.",
    ],
  },
  {
    id: "visualizer",
    title: "Path Visualizer",
    subtitle: "See how your language generates names",
    pillar: "STUDIO",
    icon: Activity,
    formula: "Interactive node graph of letter-to-letter flow",
    description:
      "An interactive graph that shows exactly how the generator moves from letter to letter. Each node is a character; each arrow shows the probability of the next character following. Type a prefix and watch the path light up.",
    mechanics: [
      {
        label: "Flow Visualization",
        detail:
          "Nodes represent characters in your trained model. Arrow thickness shows how likely each transition is — thick arrows mean common paths, thin arrows mean rare ones.",
      },
      {
        label: "Prefix Completion",
        detail:
          "Type the beginning of a word and the graph highlights every possible continuation, showing you exactly what the model will produce from that starting point.",
      },
    ],
    proTips: [
      "If most arrows funnel into the same few vowels (a, e), your language will sound melodious and open. If consonant clusters branch heavily, it will feel harsher and more guttural — both are valid, just be intentional.",
      "Watch for 2-node loops (e.g. k ↔ s) that can cause repetitive stuttering in output. Add bridge consonants or new vowel paths to break the cycle.",
      "A healthy model has 3–5 outgoing branches per consonant node. Fewer means monotone output; many more means chaotic output that loses its cultural identity.",
    ],
  },
  {
    id: "namesets",
    title: "Name Sets",
    subtitle: "Compose structured full names from word pools",
    pillar: "STUDIO",
    icon: Layers,
    formula: "[Title] + [Given Name] + [Clan Suffix]",
    description:
      "Combine separate dictionaries into multi-part naming conventions. Define which dictionaries serve as given names, which as clan names, which as honorific prefixes — then generate complete structured names with the right gender and role conventions.",
    mechanics: [
      {
        label: "Slot-Based Templates",
        detail:
          "Define a naming template with ordered slots — prefix, given name, connector, family name, suffix — and assign a dictionary to each slot.",
      },
      {
        label: "Gender & Role Conventions",
        detail:
          "Tag dictionaries as masculine, feminine, neuter, or any. Apply preset naming conventions (Icelandic patronymics, Roman tria nomina, Japanese family-first) or build your own.",
      },
    ],
    proTips: [
      "Real place names are mundane in origin. Oxford means 'ox ford.' Combine practical geography roots (river, hill, fort, bridge) with clan or founder names for grounded toponyms.",
      "Use real connector morphemes (-en-, -al-, -o-) instead of fantasy apostrophes. Your compound names will be easier to pronounce and feel more linguistically authentic.",
      "Configure distinct patronymic suffixes by gender: -son/-ov for masculine, -dottir/-ova for feminine, -ingas/-ites for collective peoples. Readers will intuit the gender system without exposition.",
      "Layer historical depth: combine an archaic root from a dead ancestor language with a modern suffix to imply centuries of settlement and cultural change in a single name.",
    ],
  },
  {
    id: "shifts",
    title: "Sound Shifts",
    subtitle: "Age your language across historical epochs",
    pillar: "STUDIO",
    icon: Split,
    formula: "Proto Word → Epoch 1 → Epoch 2 → Modern Form",
    description:
      "Simulate centuries of linguistic evolution. Define sound change rules — which sounds transform in which environments — then run your entire vocabulary through sequential historical epochs. The output shows you what your proto-language sounds like after 400 years of drift.",
    mechanics: [
      {
        label: "Sound Change Rules",
        detail:
          "Write rules in standard historical linguistics notation: 'p → f' (always), 'k → s / _e' (before front vowels), 'n → ∅ / _#' (drop word-final n). Presets for Grimm's Law, Romance Lenition, and Slavic Palatalization are included.",
      },
      {
        label: "Epoch Stacking",
        detail:
          "Chain multiple eras (Proto → Classical → Medieval → Modern) and see how each word transforms step by step, with changed sounds highlighted at every stage.",
      },
      {
        label: "Pronunciation Preview",
        detail:
          "Hear both the original proto-form and the evolved modern form spoken aloud to compare how the shift changes the spoken character of your language.",
      },
    ],
    proTips: [
      "Language is lazy. Sounds naturally drift toward ease of articulation: stops between vowels soften (p → b → v), consonant clusters simplify (kn → n), unstressed syllables drop. Let this principle guide your shift rules.",
      "Run your proto-language through 2–3 sequential eras to create authentic archaic forms. Your ancient scriptures, old place names, and modern speech will all sound related but distinct — exactly like real language families.",
      "Use context-sensitive environments to create natural exceptions: a consonant might soften between vowels (intervocalic lenition) but stay hard at the beginning of words. This creates the irregular-but-patterned feel of real languages.",
      "Save the intermediate epoch forms. Your Classical-era vocabulary makes perfect material for religious texts and formal titles, while the Modern forms work for everyday speech and commoner names.",
    ],
  },

  // --- EXPLORE PILLAR ---
  {
    id: "phonology",
    title: "Acoustics & IPA",
    subtitle: "Hear your language and map its sound space",
    pillar: "EXPLORE",
    icon: Volume2,
    formula: "Vowel Quadrilateral · Formant Spectrum · IPA Rules",
    description:
      "Visualize where your language's vowels sit on the IPA chart, edit how each written letter maps to its spoken sound, and audition pronunciation with neural speech synthesis. Includes per-culture pronunciation rule editing and per-name overrides.",
    mechanics: [
      {
        label: "Vowel Quadrilateral",
        detail:
          "A 2D acoustic chart plotting your language's vowels by height (jaw opening) and backness (tongue position). See at a glance whether your vowel space is balanced or clustered.",
      },
      {
        label: "Grapheme-to-IPA Editor",
        detail:
          "Customize how each written letter or digraph maps to its IPA phoneme, per cultural profile. Override individual name pronunciations when the automatic rules don't capture your intent.",
      },
      {
        label: "Neural Speech Audition",
        detail:
          "Hear any name or IPA transcription spoken aloud using Kokoro neural voice synthesis, with multiple voice presets tailored to different species and vocal profiles.",
      },
    ],
    proTips: [
      "Over 70% of human languages use a simple 5-vowel system (i, e, a, o, u). Start there. Adding nasalized or retroflex vowels later creates the feeling of a more complex, ancient language.",
      "Use vowel placement to set emotional tone. High front vowels (i, e) sound sharp, quick, and agile — good for elvish or mercantile tongues. Low back vowels (u, o, ɑ) sound deep, ancient, and ominous — natural for dwarven or chthonic languages.",
      "For non-human species, shift the whole vowel chart. Giants would have lowered formants from larger vocal tracts. Avian beings would favor high-frequency fricatives and trills.",
      "Edit the grapheme-to-IPA rules for your culture so that every name you generate gets the correct pronunciation automatically — no need to override each name individually.",
    ],
  },
  {
    id: "grammar",
    title: "Grammar & Roots",
    subtitle: "Word order, case systems, and root derivation trees",
    pillar: "EXPLORE",
    icon: GitBranch,
    formula: "Root Morpheme → Prefix/Suffix Derivations → Vocabulary Tree",
    description:
      "Two tools in one. Root Derivations lets you build etymological trees — define a root word, then branch it into dozens of derived terms with prefixes and suffixes. Sentence Grammar lets you define word order, case endings, verb conjugations, and articles, then build test sentences in your conlang.",
    mechanics: [
      {
        label: "Root Derivation Trees",
        detail:
          "Create root morphemes with meanings and IPA, then attach derived words branching outward — prefixes, suffixes, compound forms — building a visual etymology web that shows how your vocabulary grows from a handful of roots.",
      },
      {
        label: "Sentence Grammar Builder",
        detail:
          "Configure word order (SVO, SOV, VSO), case suffixes (nominative, accusative, genitive), verb tenses (past, present, future), articles, and plurals. Then compose test sentences and see them rendered in your conlang.",
      },
      {
        label: "Conlang Dictionary",
        detail:
          "Maintain a working English-to-conlang dictionary that the sentence builder uses for live translation.",
      },
    ],
    proTips: [
      "Word order shapes how your culture sounds. SVO (English) feels direct and active. SOV (Latin, Japanese) feels formal and deliberate. VSO (Classical Arabic, Irish) feels poetic and incantatory.",
      "You only need 4 grammatical cases for full expressive power: Nominative (who acts), Accusative (who receives), Genitive (who possesses), and Dative (to whom). Add more only when your world demands it.",
      "Build your dictionary from root derivations. If your root 'ven-' means 'wind,' derive 'venara' (storm), 'vensi' (breeze), 'vento' (to blow) — one root seeds an entire semantic family with internal consistency.",
      "Ancient languages tend to be synthetic (heavy inflection, many case suffixes). Modern descendant languages simplify toward analytic structures (fixed word order, prepositions). Your historical timeline should reflect this drift.",
    ],
  },
  {
    id: "writing",
    title: "Writing Systems",
    subtitle: "Design custom scripts and test full typography",
    pillar: "EXPLORE",
    icon: Type,
    formula: "Glyph Designer → Phoneme Map → Orthography Sandbox",
    description:
      "Design an original script for your conlang. Draw vector letterforms on a precision canvas with typographic guides, map each glyph to its phoneme, classify your script type (alphabet, abjad, abugida, syllabary, or logographic), then render full sentences in a typographic sandbox with adjustable direction, spacing, and baseline.",
    mechanics: [
      {
        label: "Glyph Forge Canvas",
        detail:
          "A vector drawing surface with typographic hairlines (ascender, cap height, x-height, baseline, descender) and a stamp library of reusable geometric primitives for consistent stroke patterns.",
      },
      {
        label: "Script Classification",
        detail:
          "Choose how your script encodes language: Alphabet (Latin/Greek — each sound gets a letter), Abjad (Arabic/Hebrew — consonants only, vowels implied), Abugida (Devanagari — consonant+vowel units), Syllabary (Hiragana), or Logographic.",
      },
      {
        label: "Orthography Sandbox",
        detail:
          "Type text and see it rendered in your custom script with configurable direction (LTR, RTL, vertical), letter spacing, word gaps, glyph size, and baseline offset. Persisted to your account across sessions.",
      },
    ],
    proTips: [
      "Let the writing medium dictate your letterforms. Scripts carved in stone use straight angular strokes (Runes, Ogham). Scripts pressed into clay use wedge marks (Cuneiform). Scripts brushed on parchment use flowing curves (Arabic, CJK). Decide what your culture writes on before you design the letters.",
      "Don't make an English cipher. Decide whether vowels are written at all (Abjad), written as diacritics on consonants (Abugida), or given their own full letters (Alphabet). This single decision transforms how your script looks and feels.",
      "Pick 3–4 foundational stroke motifs (hooks, diagonal strokes, loops, dots) and reuse them across all glyphs. This creates the visual family unity that makes a script feel like it was invented by one culture, not assembled from random shapes.",
      "Use the Stamp drawer to build a palette of reusable geometric components. Real scripts evolve from a small set of base forms — your constructed script should too.",
    ],
  },
  {
    id: "loanwords",
    title: "Loanwords & Contact Adaptation",
    subtitle: "Simulate vocabulary exchange and phonetic borrowing",
    pillar: "STUDIO",
    icon: Globe,
    formula: "Donor Language → Sound Shifts + Syllable Adaptation → Recipient",
    description:
      "Model how words travel between languages during trade, conquest, or scholarly exchange. Define a donor language, apply sound shifts that simulate phonological adaptation, and see how foreign terms mutate to fit your conlang's sound rules. Includes thematic presets for trade, military, science, religion, and governance vocabulary.",
    mechanics: [
      {
        label: "Contact Channels",
        detail:
          "Establish directional borrowing relationships between a donor and recipient language. Choose thematic domains — a conquering empire exports military and legal terms, while the native population exports landscape and agricultural words.",
      },
      {
        label: "Phonological Adaptation",
        detail:
          "Apply sound shifts to incoming foreign words so they conform to your conlang's phonetic rules. Includes presets for common historical patterns (Grimm's Law, Romance Lenition, Slavic Palatalization).",
      },
      {
        label: "Syllable Constraint Strategies",
        detail:
          "When a foreign word violates your syllable rules, choose how your language handles it: Coda Drop (strip illegal final consonants) or Vowel Epenthesis (insert a support vowel to maintain open syllables).",
      },
    ],
    proTips: [
      "Conquering cultures export prestige vocabulary — court titles, military ranks, philosophical terms, legal concepts. Subjugated populations export the words for local terrain, native plants, and traditional food. This asymmetry is universal in real-world language contact.",
      "Foreign words always adapt to the recipient's sound rules. When English borrowed 'tsunami' from Japanese, speakers dropped the word-initial /ts/ because English doesn't allow it. Your conlang should enforce the same kind of phonotactic policing.",
      "If your conlang forbids closed syllables, decide its adaptation strategy. Italian and Polynesian languages add support vowels (epenthesis: 'golf' → 'golfo'). Hawaiian drops the offending consonant entirely (coda drop: 'Christmas' → 'Kalikimaka').",
      "Track loanwords across multiple contact channels to build stratigraphic etymology — your readers can trace which ancient empire ruled which region by which layer of borrowed vocabulary survives in local speech.",
    ],
  },
  {
    id: "compare",
    title: "Comparison",
    subtitle: "Compare two language profiles side by side",
    pillar: "EXPLORE",
    icon: Search,
    formula: "Profile A vs Profile B → Phonetic Distance + Sample Names",
    description:
      "Place two cultural language profiles side by side to compare their phonetic inventories, vowel distributions, consonant patterns, and generated sample names. Generate hybrid blends to explore what a creole or border dialect between two cultures might sound like.",
    mechanics: [
      {
        label: "Profile Comparison",
        detail:
          "Select any two of the 12 cultural profiles and see a detailed breakdown of shared vs. divergent phonetic features, syllable structures, and name patterns.",
      },
      {
        label: "Hybrid Generation",
        detail:
          "Generate blend names that combine the phonetic characteristics of both profiles — useful for border regions, trade pidgins, or creole languages in your world.",
      },
    ],
    proTips: [
      "Use the Swadesh List principle: compare core survival vocabulary (water, fire, sun, eye, mother, two) to verify family relationships. Culture-specific words like 'parliament' or 'cathedral' are borrowed — they prove contact, not kinship.",
      "Two unrelated languages sharing 2–3 similar words is coincidence. Systematic sound correspondences across 50+ roots is proof of common ancestry. Use this to decide which of your conlangs are actually related.",
      "For neighboring provinces, keep phonetic distance low (under 30%) for mutual intelligibility. Over 60% and you've got a distinct daughter language — useful for political tension in your world.",
      "Generate hybrid blends for border regions, trade ports, and conquered territories. A creole emerges wherever two languages are forced to coexist, and it always sounds distinct from either parent.",
    ],
  },
  {
    id: "packs",
    title: "Community Packs",
    subtitle: "Pre-built language models ready to use or fork",
    pillar: "EXPLORE",
    icon: Library,
    formula: "Phonology + Word List + Sound Rules in 1 Pack",
    description:
      "Browse ready-to-use language packs built on real-world linguistic families — Norse Runic, Imperial Latin, Elvish, Dwarven, and more. Load any pack into the Create generator or fork it into your Workshop to customize. Rate and review packs from other worldbuilders.",
    mechanics: [
      {
        label: "Pre-Built Models",
        detail:
          "Each pack bundles a trained word corpus, phonetic profile, and optional sound shift rules. Load one to immediately start generating names in that linguistic style.",
      },
      {
        label: "Fork & Customize",
        detail:
          "Clone any pack into your Workshop with one click. Modify the word list, adjust the model depth, add sound shifts — the forked version is yours to evolve.",
      },
    ],
    proTips: [
      "Fork a pre-built pack to learn how it works before building your own from scratch. Reverse-engineering a well-constructed language model teaches you more about phonotactics than any tutorial.",
      "Clone your main language pack, apply 2–3 regional sound shifts, and save it as a provincial dialect. In under 2 minutes you have linguistically related but distinct regional speech — exactly how real dialect continua work.",
    ],
  },

  // --- UTILITY TABS ---
  {
    id: "bank",
    title: "Stash",
    subtitle: "Your permanent library of names and dictionaries",
    pillar: "SYSTEM",
    icon: Bookmark,
    formula: "Saved Names + Dictionaries + Lexicon Entries → Organized Library",
    description:
      "Everything you save lands here. Individual names, trained dictionaries, lexicon entries with definitions and IPA — organized by stash folder, searchable, and exportable. The Stash also includes a built-in Lexicon editor for adding formal definitions, and a History log of all generated batches.",
    mechanics: [
      {
        label: "Folder Organization",
        detail:
          "Create named stash folders to group vocabulary by project, culture, region, or chapter. Filter and search across your entire saved library.",
      },
      {
        label: "Lexicon Editor",
        detail:
          "Add full dictionary entries — word, definition, IPA transcription, part of speech, etymology notes — and build a formal conlang dictionary alongside your name library.",
      },
      {
        label: "Import & Export",
        detail:
          "Import word lists from text files or JSON. Export your curated vocabulary to CSV, JSON, or copy to clipboard for use in Obsidian, World Anvil, or any external tool.",
      },
    ],
    proTips: [
      "Organize by geography and faction early. Tags like #northern-provinces, #house-valdren, #sacred-liturgy keep your lore bible navigable as your world grows beyond a single notebook page.",
      "Use the Lexicon editor to build a real conlang dictionary alongside your names. When a reader asks 'what does Valdren mean?' you'll have the etymology, IPA, and derivation chain ready.",
    ],
  },
];
