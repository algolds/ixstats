// src/app/admin/cards/LoreCardBatchAdmin.tsx
// Unified Theme-Compliant Apple Design Lore Card Batch Generator & User Request Queue
"use client";

import { useState, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Download,
  Search,
  X,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Upload,
  UserCheck,
  Sliders,
  Layers,
  FileText,
  Trash2,
  Play,
  Shield,
  Compass,
  Crown,
  Scroll,
  Landmark,
  Sparkles,
  Scale,
  History,
  Building,
  ImageIcon,
  Eye,
  Copy,
  ExternalLink,
  RotateCcw,
  Info,
} from "lucide-react";
import type { CardRarity } from "@prisma/client";
import type { CardAuthorInfo } from "~/types/cards-display";
import { IIWikiBadge } from "~/components/cards/display";

import { LoreCategory, CATEGORY_SYNONYMS } from "~/lib/cards";

// Canonical Category Preset Crawlers with synonyms and alternate terms
export const CATEGORY_PRESETS = [
  {
    name: "Sovereign Nations",
    tag: LoreCategory.NATION,
    categoryName: "Countries",
    icon: Globe,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.NATION],
    terms: [
      "Alba Concordia",
      "Alcairet",
      "Algosh Republic",
      "Almadaria",
      "Alstin",
      "Amaniaris",
      "Antilles",
      "Ardmore",
      "Argaea",
      "Argyrea",
      "Arona",
      "Arsesia",
      "Asteria",
      "Atapakona",
      "Atavia",
      "Atrassica",
      "Avonia",
      "Battganuur",
      "Betlands",
      "Borealia",
      "Bulkh",
      "Burgundie",
      "Caergwynn",
      "Caldera",
      "Canespa",
      "Canpei",
      "Cao",
      "Caphiria",
      "Caracua",
      "Cartadania",
      "Castadilla",
      "Ceylonia",
      "Chakailan",
      "Chaukhira",
      "Chenango Confederacy",
      "Copake",
      "Daxia",
      "Drasenia",
      "East Arctic Mandate",
      "Eileada",
      "Equatorial Ostiecia",
      "Escal Isles",
      "Faneria",
      "Fiannria",
      "Freda Island",
      "Galata",
      "Halfway",
      "Hendalarsk",
      "Herciana",
      "Hezikian Isles",
      "Hollona and Diorisia",
      "Housatonic",
      "Huadao",
      "Huoxia",
      "Iles Evangeline",
      "International Canal Zone",
      "International Nature Preserve",
      "Isidar",
      "Istrenya",
      "Jinju",
      "Kabasa",
      "Kandara",
      "Kelekona",
      "Kiravia",
      "Kostava",
      "Krasoa Islands",
      "Lapody",
      "Lariana",
      "League of Nations",
      "Lotoa",
      "Lucrecia",
      "Malentina",
      "Mandatory Venua'tino",
      "Maresteyn",
      "Maristella",
      "Mehristan",
      "Melian Islands",
      "Metzetta",
      "Mid-Atrassic States",
      "Mierria",
      "Moonlight Keys",
      "Nasastan",
      "Netansett",
      "New Archduchy",
      "New Ardmore",
      "New Harren",
      "New Spelferland",
      "New Veltorina",
      "Olmeria",
      "Otisco",
      "Oyashima",
      "Papal State",
      "Paulastra",
      "Pelaxia",
      "Porlos",
      "Port de Vent",
      "Porta Bianca",
      "Pukhgundi",
      "Purepec",
      "Pursat",
      "Quetzenkel",
      "Rapa Rapa",
      "Rhotia",
      "Rusana",
      "Sakhalins",
      "Samalosi",
      "Scapa",
      "Seneca Islands",
      "Sevaronsa",
      "Shenendehowa Bay",
      "Slaconia",
      "Solemia",
      "Sorhaithe",
      "Sotsial",
      "St. Kennera & Pribalter",
      "Suderavia",
      "Sudmoll",
      "Sydona Islands",
      "Tapakdore",
      "Tapkoii",
      "Telokona",
      "Teschego",
      "The Cape",
      "Thervala",
      "Thystara",
      "Tierrador",
      "Timbia",
      "Torlen",
      "Truk",
      "Umardwal",
      "Urcea",
      "Varshan",
      "Ventotene",
      "Veraise",
      "Vespera",
      "Volonia",
      "Wintergen",
      "Xisheng",
      "Yanuban",
      "Yonderre",
      "Zaclaria",
      "Zhijun",
      "Æonara",
    ],
  },
  {
    name: "Military & Wars",
    tag: LoreCategory.MILITARY,
    categoryName: "Wars",
    icon: Shield,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.MILITARY],
    terms: [
      "Great War",
      "Continental War",
      "War of the Grand Alliance",
      "Battle of the Morro",
      "Caphirian Imperial Army",
      "Urcean Royal Navy",
      "Battle of the Atrassic",
      "Siege of Alstin",
      "Atrassic Naval Campaign",
      "War of the Triple Coalition",
      "Invasion of Yanuban",
      "First Gothic War",
      "Second Gothic War",
      "Battle of Cape Verde",
      "Royal Marines of Urcea",
      "Imperial Legion of Caphiria",
      "Grand Army of Daxia",
      "Pelasgian Coastal Guard",
      "Operation Sol Shield",
      "Battle of Castadilla",
      "Siege of Metzetta",
      "Canpei Straits Skirmish",
      "Atrassica Frontier Defense",
      "Gothic Sea Fleet",
      "Western Army Corps",
    ],
  },
  {
    name: "Geography & Oceans",
    tag: LoreCategory.GEOGRAPHY,
    categoryName: "Geography",
    icon: Compass,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.GEOGRAPHY],
    terms: [
      "Atrassic Ocean",
      "Caphirian Sea",
      "Gothic Sea",
      "Sea of Canpei",
      "Pelaxian Gulf",
      "Mount Saint-Claire",
      "The Great Rift",
      "Shenendehowa Bay",
      "Straits of Canespa",
      "Cape of Storms",
      "Canpei River",
      "Great Northern Steppe",
      "Atrassica Basin",
      "Isles of Melia",
      "Seneca Archipelago",
      "Freda Trench",
      "Moonlight Sound",
      "Great Castadilla Plateau",
      "Southern Tundra",
      "Yanuban Highlands",
      "Almadaria Valley",
      "Gothic Mountains",
      "Lake Zaclaria",
      "River Alstin",
      "Urcean Peninsula",
    ],
  },
  {
    name: "Religions & Faiths",
    tag: LoreCategory.RELIGION,
    categoryName: "Religion",
    icon: Sparkles,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.RELIGION],
    terms: [
      "Catholic Church",
      "Fabianism",
      "Orthodoxy",
      "Cult of Sol",
      "Sacred Council of Ogma",
      "Order of the Eclipse",
      "Holy See of Castadilla",
      "Patriarchate of Pelaxia",
      "Urcean Episcopal Council",
      "Sovereign Knights Hospitaller",
      "Temple of the Dawn",
      "Solcordian Faith",
      "Council of Saint-Claire",
      "Cathedral of St. Jude",
      "Abbey of Alstin",
      "Priesthood of Sol",
      "Monastery of Mount Claire",
      "Sacred Order of Saint Kennera",
      "Castadilla Orthodox Synod",
      "Reformed Church of Yonderre",
    ],
  },
  {
    name: "Monarchs & Sovereigns",
    tag: LoreCategory.PEOPLE,
    categoryName: "Monarchs",
    icon: Crown,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.PEOPLE],
    terms: [
      "House of Habsburg-Lorraine",
      "Emperor of Caphiria",
      "King of Urcea",
      "High King of Yonderre",
      "Archduke of Alstin",
      "Prime Minister of Paulastra",
      "Chancellor of Daxia",
      "President of Tierrador",
      "Grand Duke of Almadaria",
      "Apostolic King",
      "Marshal of the Imperial Legion",
      "Lord High Admiral of Urcea",
      "Grand Inquisitor of Castadilla",
      "Consul of Pelaxia",
      "Prince of Burgundie",
      "Governor-General of The Cape",
      "Sovereign of Argaea",
      "Patriarch John of Pelaxia",
      "Chancellor von Willing",
      "Supreme Commander of the Alliance",
    ],
  },
  {
    name: "Diplomacy & Treaties",
    tag: LoreCategory.DIPLOMACY,
    categoryName: "Treaties",
    icon: Scroll,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.DIPLOMACY],
    terms: [
      "Treaty of Ogma",
      "Concord of Nations",
      "Atrassic Defense Pact",
      "Treaty of Aix-la-Chapelle",
      "Grand Sovereign Coalition",
      "Treaty of Castadilla",
      "Canpei Maritime Accord",
      "Pact of the Three Sovereigns",
      "Convention on Aerial Warfare",
      "Atrassica Non-Aggression Treaty",
      "Charter of the League of Nations",
      "Treaty of Urcea",
      "Alliance of Free Nations",
      "Protocol of Alstin",
      "Continental Trade Concordat",
      "Treaty of Yanuban",
      "Gothic Peace Treaty",
      "Treaty of Paulastra",
      "Castadilla Defense Protocol",
      "Mutual Defense Agreement",
    ],
  },
  {
    name: "Culture & Monuments",
    tag: LoreCategory.CULTURE,
    categoryName: "Monuments",
    icon: Landmark,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.CULTURE],
    terms: [
      "Crown Jewels of Caphiria",
      "Great Imperial Archives",
      "National Palace of Paulastra",
      "Cathedral of St. Jude",
      "Monument of the Fallen",
      "Royal Opera of Urcea",
      "National Museum of Daxia",
      "Grand Library of Ogma",
      "Palace of Nations",
      "Hall of Sovereigns",
      "Citadel of Alstin",
      "Castadilla National Gallery",
      "Tomb of the Unknown Soldier",
      "Imperial Regalia of Yonderre",
      "Arch of Triumph",
      "Sovereign Scepter",
      "National Conservatory",
      "Great Tapestry of Concord",
      "Order of Merit Insignia",
      "Cathedral of Holy Wisdom",
    ],
  },
  {
    name: "Science & Industry",
    tag: LoreCategory.SCIENCE,
    categoryName: "Science",
    icon: Layers,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.SCIENCE],
    terms: [
      "Imperial Rail Network",
      "Trans-Atrassic Telegraph",
      "Aeronautical Research Institute",
      "Royal Academy of Sciences",
      "Atrassic Maritime Cable",
      "National Institute of Physics",
      "Observatory of Mount Claire",
      "Trans-Continental Express",
      "Imperial Energy Grid",
      "Royal Botanical Gardens",
      "Aero Engine Corporation",
      "Castadilla Hydroelectric Dam",
      "Naval Architecture Institute",
      "Space Research Initiative",
      "Central Geodetic Survey",
      "Academy of Engineering",
      "Grand Telephone Network",
      "Telecommunications Bureau",
      "Atmospheric Research Laboratory",
      "Aviation Corps",
    ],
  },
  {
    name: "Government & Law",
    tag: LoreCategory.GOVERNMENT,
    categoryName: "Government",
    icon: Scale,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.GOVERNMENT],
    terms: [
      "Imperial Diet of Caphiria",
      "Urcean Parliament",
      "Council of State",
      "Supreme Court of Justice",
      "Ministry of War",
      "Ministry of Foreign Affairs",
      "National Assembly of Paulastra",
      "Chamber of Deputies",
      "House of Commons of Urcea",
      "Constitutional Court of Tierrador",
      "Ministry of Finance",
      "Crown Privy Council",
      "Senate of Daxia",
      "Ministry of the Navy",
      "Imperial Chancellery",
      "High Court of Admiralty",
      "Electoral Commission",
      "Council of Ministers",
      "Department of State Security",
      "Cabinet of Ministers",
    ],
  },
  {
    name: "Economy & Finance",
    tag: LoreCategory.ECONOMY,
    categoryName: "Economy",
    icon: Coins,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.ECONOMY],
    terms: [
      "Bank of Caphiria",
      "Royal Urcean Mint",
      "Atrassic Maritime Exchange",
      "Grand Mercantile Guild",
      "Standard Trade Dollar",
      "Central Bank of Daxia",
      "Paulastra Stock Exchange",
      "Imperial Trading Company",
      "Atrassic Shipping Corporation",
      "Castadilla Iron Works",
      "National Treasury of Tierrador",
      "Urcean Steelworks",
      "Great Eastern Trading Company",
      "Gothic Sea Merchant Union",
      "Petroleum Consortium",
      "Agricultural Export Board",
      "Imperial Customs Union",
      "Maritime Insurance Exchange",
      "Bank of Settlement",
      "Gold Reserve Commission",
    ],
  },
  {
    name: "History & Eras",
    tag: LoreCategory.HISTORY,
    categoryName: "History",
    icon: History,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.HISTORY],
    terms: [
      "First Epoch",
      "Age of Discovery",
      "Fall of the Old Empire",
      "Great Revolution of 1789",
      "Golden Century",
      "Age of the Sovereigns",
      "The Long Peace",
      "Reconstruction Era",
      "First Continental Crisis",
      "The Great Migration",
      "Renaissance of Ogma",
      "Industrial Revolution",
      "The Atrassic Crisis",
      "The Great Succession",
      "Era of the Five Kings",
      "Unification of Daxia",
      "Fall of the Dynasty",
      "The Maritime Expansion",
      "The Grand Reformation",
      "Century of Concord",
    ],
  },
  {
    name: "Special & Wonders",
    tag: LoreCategory.SPECIAL,
    categoryName: "Artifacts",
    icon: Building,
    synonyms: CATEGORY_SYNONYMS[LoreCategory.SPECIAL],
    terms: [
      "Crown of Ogma",
      "Codex Aureus",
      "Orb of the High Sovereign",
      "Celestial Astrolabe",
      "Relic of the Sun",
      "The Obsidian Tome",
      "Seal of the First Emperor",
      "Scepter of Light",
      "Chronicles of the Dawn",
      "Amulet of Kings",
      "The Sunstone Reliquary",
      "Tome of the Grand Archon",
      "Golden Fleece of Sol",
      "Great Pillar of Peace",
      "The Sacred Banner",
    ],
  },
  {
    name: "IXWB Worldbuilding",
    tag: LoreCategory.SPECIAL,
    categoryName: "IXWB",
    icon: BookOpen,
    wikiSourceFilter: "ixwiki" as const,
    synonyms: [
      "ixwb",
      "ixnay worldbuilding",
      "worldbuilding",
      "ixwiki canon",
      "ixnay lore",
      "canon lore",
      "ixwiki",
    ],
    terms: [
      "Crown Jewels of Caphiria",
      "Great Archives of Ogma",
      "Treaty of Ogma",
      "Concord of Nations",
      "Caphirian Imperial Army",
      "Atrassic Ocean",
      "Solcordian Faith",
      "House of Habsburg-Lorraine",
      "Grand Imperial Archives",
      "Trans-Atrassic Telegraph",
      "Imperial Diet of Caphiria",
      "Bank of Caphiria",
      "First Epoch",
      "Crown of Ogma",
    ],
  },
] as const;





interface BatchCandidate {
  id: string;
  articleTitle: string;
  wikiSource: "ixwiki" | "iiwiki";
  targetRarity: CardRarity | "AUTO";
  season: number;
  customPrompt?: string;
  imageUrl?: string | null;
  extract?: string;
  category?: string;
  authorInfo?: CardAuthorInfo | null;
  author?: string;
  status: "idle" | "generating" | "success" | "error";
  errorMessage?: string;
  generatedCardId?: string;
  mintedArtwork?: string | null;
}

export function LoreCardBatchAdmin() {
  const notify = useNotify();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"generator" | "requests">("generator");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("ALL");

  // Generator parameters
  const [articleInput, setArticleInput] = useState("");
  const [globalWikiSource, setGlobalWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");
  const [globalTargetRarity, setGlobalTargetRarity] = useState<CardRarity | "AUTO">("AUTO");
  const [globalSeason, setGlobalSeason] = useState<number>(1);
  const [globalPromptModifier, _setGlobalPromptModifier] = useState("");

  // Batch candidate queue
  const [candidates, setCandidates] = useState<BatchCandidate[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<"ALL" | "idle" | "generating" | "success" | "error">("ALL");
  const [selectedErrorCandidate, setSelectedErrorCandidate] = useState<BatchCandidate | null>(null);

  // Computed queue metrics
  const idleCount = useMemo(() => candidates.filter((c) => c.status === "idle").length, [candidates]);
  const generatingCount = useMemo(() => candidates.filter((c) => c.status === "generating").length, [candidates]);
  const successCount = useMemo(() => candidates.filter((c) => c.status === "success").length, [candidates]);
  const errorCount = useMemo(() => candidates.filter((c) => c.status === "error").length, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (candidateStatusFilter === "ALL") return candidates;
    return candidates.filter((c) => c.status === candidateStatusFilter);
  }, [candidates, candidateStatusFilter]);

  // Lightbox modal for previewing artwork on click
  const [previewImage, setPreviewImage] = useState<{
    title: string;
    imageUrl: string;
    extract?: string;
    wikiSource?: string;
    category?: string;
    rarity?: string;
    season?: number;
    author?: string;
  } | null>(null);

  // Duplicate purging modal
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);

  // Author backfill modal
  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState(false);
  const [backfillLimit, setBackfillLimit] = useState(100);
  const [backfillSource, setBackfillSource] = useState<"all" | "ixwiki" | "iiwiki">("all");

  // Re-classify categories modal
  const [isReclassifyDialogOpen, setIsReclassifyDialogOpen] = useState(false);
  const [reclassifyLimit, setReclassifyLimit] = useState(100);
  const [reclassifySource, setReclassifySource] = useState<"all" | "ixwiki" | "iiwiki">("all");
  const [reclassifyForce, setReclassifyForce] = useState(false);

  // Rejection modal
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();

  // Duplicate cards statistics
  const { data: duplicateStats, refetch: refetchDuplicates } =
    api.loreCards.getDuplicateCardsStats.useQuery();

  const purgeDuplicatesMutation = api.loreCards.purgeDuplicateCards.useMutation({
    onSuccess: (data: { message: string }) => {
      notify.success("Duplicates Purged", data.message);
      setIsPurgeDialogOpen(false);
      void refetchDuplicates();
      void utils.cards.getUnifiedAuditLogs.invalidate();
      void utils.cards.getLoreStats.invalidate();
    },
    onError: (err: { message: string }) => notify.error("Purge Error", err.message),
  });

  const backfillAuthorsMutation = api.loreCards.backfillWikiAuthors.useMutation({
    onSuccess: (data: { count: number; message: string }) => {
      notify.success("Authors Backfilled", data.message);
      setIsBackfillDialogOpen(false);
      void utils.cards.getUnifiedAuditLogs.invalidate();
      void utils.cards.getLoreStats.invalidate();
    },
    onError: (err: { message: string }) => notify.error("Backfill Error", err.message),
  });

  const reclassifyCategoriesMutation = api.loreCards.reclassifyLoreCards.useMutation({
    onSuccess: (data: { processedCount: number; reclassifiedCount: number; message: string }) => {
      notify.success("Categories Re-Cataloged", data.message);
      setIsReclassifyDialogOpen(false);
      void utils.cards.getUnifiedAuditLogs.invalidate();
      void utils.cards.getLoreStats.invalidate();
    },
    onError: (err: { message: string }) => notify.error("Re-Catalog Error", err.message),
  });

  // Deduplicate in-memory queue
  const handleDeduplicateQueue = () => {
    const seen = new Set<string>();
    let removed = 0;
    const deduplicated: BatchCandidate[] = [];
    for (const c of candidates) {
      const key = `${c.wikiSource}:${c.articleTitle.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(c);
      } else {
        removed++;
      }
    }
    setCandidates(deduplicated);
    if (removed > 0) {
      notify.success("Queue Deduplicated", `Removed ${removed} redundant duplicate item(s) from candidate queue.`);
    } else {
      notify.info("Queue Clean", "No duplicate items found in candidate queue.");
    }
  };

  // Asynchronously enrich candidate image thumbnails
  const enrichCandidateThumbnails = async (newItems: BatchCandidate[]) => {
    const titlesToEnrich = newItems.filter((c) => !c.imageUrl).map((c) => c.articleTitle);
    if (titlesToEnrich.length === 0) return;
    try {
      const res = await utils.loreCards.fetchArticlePreviewsBatch.fetch({
        titles: titlesToEnrich.slice(0, 100),
        source: globalWikiSource,
      });
      if (res.previews && res.previews.length > 0) {
        const previewMap = new Map(res.previews.map((p) => [p.title.toLowerCase(), p]));
        setCandidates((prev) =>
          prev.map((c) => {
            const p = previewMap.get(c.articleTitle.toLowerCase());
            if (p) {
              return {
                ...c,
                imageUrl: p.imageUrl || c.imageUrl || null,
                extract: p.extract || c.extract,
                category: c.category || p.category,
                authorInfo: p.authorInfo || null,
                author: p.authorInfo?.displayAuthor,
              };
            }
            return c;
          })
        );
      }
    } catch (e) {
      console.warn("Thumbnail enrichment failed:", e);
    }
  };

  // tRPC queries
  const requestStats = api.loreCards.getRequestStats.useQuery(undefined, {
    enabled: activeTab === "requests",
  });

  const statusParam = requestStatusFilter === "ALL" ? undefined : (requestStatusFilter as any);
  const requestQueue = api.loreCards.getRequestQueue.useQuery(
    { status: statusParam, limit: 50 },
    { enabled: activeTab === "requests" }
  );

  // Mutations
  const approveMutation = api.loreCards.approveRequest.useMutation({
    onSuccess: (data) => {
      notify.success("Request Approved", data.message || "Request approved.");
      void utils.loreCards.getRequestQueue.invalidate();
      void utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => notify.error("Approval Error", err.message),
  });

  const rejectMutation = api.loreCards.rejectRequest.useMutation({
    onSuccess: (data) => {
      notify.info("Request Rejected", data.message || "Request rejected and user refunded.");
      setRejectionRequestId(null);
      setRejectionReason("");
      void utils.loreCards.getRequestQueue.invalidate();
      void utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => notify.error("Rejection Error", err.message),
  });

  const generateRequestedMutation = api.loreCards.generateRequestedCard.useMutation({
    onSuccess: (data) => {
      notify.success("Lore Card Minted", data.message || "Lore card generated successfully.");
      void utils.loreCards.getRequestQueue.invalidate();
      void utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => notify.error("Generation Error", err.message),
  });


  const generateCardMutation = api.loreCards.generateLoreCard.useMutation();

  // Category Search & Live Crawler State
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isCrawlingCategory, setIsCrawlingCategory] = useState(false);
  const [isCrawlingAllPages, setIsCrawlingAllPages] = useState(false);
  const [crawlingPresetName, setCrawlingPresetName] = useState<string | null>(null);

  const { data: categorySearchData, isFetching: _isSearchingCategories } =
    api.loreCards.searchWikiCategories.useQuery(
      {
        source: globalWikiSource,
        prefix: categorySearchQuery.trim(),
        limit: 25,
      },
      {
        enabled: categorySearchQuery.trim().length > 0,
      }
    );

  const { data: categoryStatsData } = api.loreCards.getCategoryStats.useQuery(
    {
      source: globalWikiSource,
      categories: CATEGORY_PRESETS.map((p) => p.categoryName),
    },
    {
      staleTime: 60 * 1000,
    }
  );

  // Live Category Crawler
  const handleCrawlCategory = async (categoryName: string) => {
    const cleanCat = categoryName.replace(/^category:\s*/i, "").trim();
    if (!cleanCat) return;

    setIsCrawlingCategory(true);
    try {
      const res = await utils.loreCards.fetchWikiCategoryMembers.fetch({
        source: globalWikiSource,
        category: cleanCat,
        limit: 10000,
        type: "page|file",
      });

      if (!res.titles || res.titles.length === 0) {
        notify.info(
          "No Articles Found",
          `No namespace-0 articles found in Category:${cleanCat} on ${globalWikiSource}.`
        );
        return;
      }

      const newCandidates: BatchCandidate[] = res.titles.map((title, i) => ({
        id: `cat-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier
          ? `${globalPromptModifier}, Category:${cleanCat}`
          : `Category:${cleanCat}`,
        status: "idle",
      }));

      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      setCategorySearchQuery("");
      setIsCategoryDropdownOpen(false);
      notify.success(
        "Category Loaded",
        `Added ${newCandidates.length.toLocaleString()} articles & files from Category:${cleanCat} on ${globalWikiSource.toUpperCase()} to queue.`
      );
    } catch (err: any) {
      notify.error("Category Crawl Failed", err?.message || "Failed to fetch category members.");
    } finally {
      setIsCrawlingCategory(false);
    }
  };


  // Crawl All Main Namespace (0) Pages
  const handleCrawlAllMainPages = async () => {
    setIsCrawlingAllPages(true);
    try {
      const res = await utils.loreCards.fetchAllMainNamespacePages.fetch({
        source: globalWikiSource,
        limit: 1000,
      });

      if (!res.titles || res.titles.length === 0) {
        notify.info("No Pages Found", `No main namespace (0) pages found on ${globalWikiSource}.`);
        return;
      }

      const newCandidates: BatchCandidate[] = res.titles.map((title, i) => ({
        id: `allpages-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier || undefined,
        status: "idle",
      }));

      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      notify.success(
        "Main Pages Loaded",
        `Loaded ${newCandidates.length} namespace-0 articles from ${globalWikiSource.toUpperCase()} into batch queue.`
      );
    } catch (err: any) {
      notify.error("Namespace 0 Crawl Failed", err?.message || "Failed to fetch all namespace 0 pages.");
    } finally {
      setIsCrawlingAllPages(false);
    }
  };

  // Add items from text input (supports standard titles and Category:<Name> format)
  const handleAddArticlesFromText = async () => {
    if (!articleInput.trim()) return;
    const rawLines = articleInput
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const normalTitles: string[] = [];
    const categoryNames: string[] = [];

    for (const line of rawLines) {
      if (/^category:\s*/i.test(line)) {
        const cat = line.replace(/^category:\s*/i, "").trim();
        if (cat) categoryNames.push(cat);
      } else {
        normalTitles.push(line);
      }
    }

    let totalAdded = 0;
    const newCandidates: BatchCandidate[] = [];

    // Add standard articles
    for (let i = 0; i < normalTitles.length; i++) {
      newCandidates.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: normalTitles[i],
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier || undefined,
        status: "idle",
      });
      totalAdded++;
    }

    // Crawl any category lines
    if (categoryNames.length > 0) {
      for (const cat of categoryNames) {
        try {
          const res = await utils.loreCards.fetchWikiCategoryMembers.fetch({
            source: globalWikiSource,
            category: cat,
            limit: 500,
          });
          if (res.titles && res.titles.length > 0) {
            for (let j = 0; j < res.titles.length; j++) {
              newCandidates.push({
                id: `cat-${Date.now()}-${j}-${Math.random().toString(36).slice(2, 6)}`,
                articleTitle: res.titles[j],
                wikiSource: globalWikiSource,
                targetRarity: globalTargetRarity,
                season: globalSeason,
                customPrompt: globalPromptModifier
                  ? `${globalPromptModifier}, Category:${cat}`
                  : `Category:${cat}`,
                status: "idle",
              });
              totalAdded++;
            }
          }
        } catch (catErr: any) {
          console.warn(`Failed to crawl category "${cat}":`, catErr);
        }
      }
    }

    setCandidates((prev) => [...prev, ...newCandidates]);
    void enrichCandidateThumbnails(newCandidates);
    setArticleInput("");
    if (totalAdded > 0) {
      notify.success("Articles Added", `Added ${totalAdded} candidate(s) to the batch queue.`);
    } else {
      notify.info("No Articles Found", "No valid articles or category members could be added.");
    }
  };


  // Preset Crawler Loader - crawls all live category pages & files (up to 10,000)
  const handleApplyPreset = async (preset: typeof CATEGORY_PRESETS[number]) => {
    setCrawlingPresetName(preset.name);
    try {
      // 1. Live crawl category from MediaWiki (fetching all pages & files up to 10,000)
      const res = await utils.loreCards.fetchWikiCategoryMembers.fetch({
        source: globalWikiSource,
        category: preset.categoryName,
        limit: 10000,
        type: "page|file",
      });

      let allTitles = res.titles ? [...res.titles] : [];

      // Merge seed terms so verified items are always included
      if (allTitles.length > 0) {
        const titleSet = new Set(allTitles.map((t) => t.toLowerCase()));
        for (const term of preset.terms) {
          if (!titleSet.has(term.toLowerCase())) {
            allTitles.push(term);
          }
        }
      } else {
        // Fallback to canonical terms if live crawl returns empty
        allTitles = [...preset.terms];
      }

      if (allTitles.length === 0) {
        notify.info("No Articles Found", `No articles found for preset "${preset.name}".`);
        return;
      }

      const newCandidates: BatchCandidate[] = allTitles.map((title, i) => ({
        id: `preset-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier
          ? `${globalPromptModifier}, ${preset.name}`
          : preset.name,
        status: "idle",
      }));

      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      notify.success(
        "Preset Applied",
        `Loaded ${newCandidates.length.toLocaleString()} articles & files from "${preset.name}".`
      );
    } catch (_err: any) {
      // Fall back to seed terms on error
      const newCandidates: BatchCandidate[] = preset.terms.map((title, i) => ({
        id: `preset-${Date.now()}-${i}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier
          ? `${globalPromptModifier}, ${preset.name}`
          : preset.name,
        status: "idle",
      }));
      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      notify.success(
        "Preset Applied",
        `Loaded ${newCandidates.length.toLocaleString()} canonical articles from "${preset.name}".`
      );
    } finally {
      setCrawlingPresetName(null);
    }
  };


  // CSV/JSON File Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const newCandidates: BatchCandidate[] = list.map((item: any, i) => ({
            id: `json-${Date.now()}-${i}`,
            articleTitle: item.title || item.articleTitle || "Untitled Article",
            wikiSource: item.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki",
            targetRarity: item.targetRarity || globalTargetRarity,
            season: item.season || globalSeason,
            customPrompt: item.customPrompt || globalPromptModifier || undefined,
            status: "idle",
          }));
          setCandidates((prev) => [...prev, ...newCandidates]);
          void enrichCandidateThumbnails(newCandidates);
          notify.success("JSON Imported", `Imported ${newCandidates.length} candidates from JSON.`);
        } else {
          // CSV Parse
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          const newCandidates: BatchCandidate[] = [];
          lines.forEach((line, i) => {
            const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
            if (cols[0] && cols[0].toLowerCase() !== "title" && cols[0].toLowerCase() !== "articletitle") {
              newCandidates.push({
                id: `csv-${Date.now()}-${i}`,
                articleTitle: cols[0],
                wikiSource: cols[1] === "iiwiki" ? "iiwiki" : globalWikiSource,
                targetRarity: (cols[2] as CardRarity) || globalTargetRarity,
                season: parseInt(cols[3], 10) || globalSeason,
                customPrompt: cols[4] || globalPromptModifier || undefined,
                status: "idle",
              });
            }
          });
          setCandidates((prev) => [...prev, ...newCandidates]);
          void enrichCandidateThumbnails(newCandidates);
          notify.success("CSV Imported", `Imported ${newCandidates.length} candidates from CSV.`);
        }
      } catch (_err) {
        notify.error("Import Error", "Failed to parse file. Ensure valid JSON or CSV format.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Export Batch to JSON
  const handleExportJSON = () => {
    if (candidates.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(candidates, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lore_batch_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notify.success("Batch Exported", "Exported candidates to JSON.");
  };

  // Retry a single failed candidate
  const handleRetryCandidate = async (candidateId: string) => {
    const item = candidates.find((c) => c.id === candidateId);
    if (!item) return;

    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, status: "generating", errorMessage: undefined } : c))
    );

    try {
      const res = await generateCardMutation.mutateAsync({
        articleTitle: item.articleTitle,
        wikiSource: item.wikiSource,
        targetRarity: item.targetRarity !== "AUTO" ? item.targetRarity : undefined,
        customPrompt: item.customPrompt,
      });

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? {
                ...c,
                status: "success",
                generatedCardId: res.cardId,
                mintedArtwork: (res as any).artworkUrl || item.imageUrl || null,
                errorMessage: undefined,
              }
            : c
        )
      );
      notify.success("Card Minted", `Successfully minted lore card for "${item.articleTitle}".`);
    } catch (err: any) {
      const errorMsg = err?.message || "Generation failed";
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, status: "error", errorMessage: errorMsg }
            : c
        )
      );
      notify.error("Retry Failed", errorMsg);
    }
  };

  // Reset all failed candidates back to idle and process batch
  const handleRetryAllFailed = async () => {
    const failedItems = candidates.filter((c) => c.status === "error");
    if (failedItems.length === 0) {
      notify.info("No Failed Candidates", "There are no failed items in the queue to retry.");
      return;
    }

    setCandidates((prev) =>
      prev.map((c) => (c.status === "error" ? { ...c, status: "idle", errorMessage: undefined } : c))
    );
    notify.info("Resetting Failed Items", `Reset ${failedItems.length} candidate(s) to queued status.`);
  };

  // Clear only failed candidates from queue
  const handleClearFailed = () => {
    const count = candidates.filter((c) => c.status === "error").length;
    setCandidates((prev) => prev.filter((c) => c.status !== "error"));
    notify.info("Failed Candidates Cleared", `Removed ${count} failed candidate(s) from the queue.`);
  };

  // Copy error report of failed candidates
  const handleCopyErrorReport = () => {
    const failedItems = candidates.filter((c) => c.status === "error");
    if (failedItems.length === 0) {
      notify.info("No Errors", "No failed candidates in the queue.");
      return;
    }

    const report = [
      `# Lore Card Import Failure Report (${new Date().toLocaleString()})`,
      `Total Failures: ${failedItems.length}`,
      "",
      ...failedItems.map(
        (c, i) =>
          `${i + 1}. [${c.wikiSource.toUpperCase()}] "${c.articleTitle}" — Error: ${c.errorMessage || "Unknown generation error"}`
      ),
    ].join("\n");

    void navigator.clipboard.writeText(report);
    notify.success("Error Report Copied", `Copied diagnostic details for ${failedItems.length} failed articles to clipboard.`);
  };

  // Process Entire Batch
  const handleProcessBatch = async () => {
    const idleCandidates = candidates.filter((c) => c.status === "idle");
    if (idleCandidates.length === 0) {
      notify.info("No Idle Candidates", "Add candidates to the queue or reset failed ones.");
      return;
    }

    setIsProcessingBatch(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of idleCandidates) {
      setCandidates((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, status: "generating", errorMessage: undefined } : c))
      );

      try {
        const res = await generateCardMutation.mutateAsync({
          articleTitle: item.articleTitle,
          wikiSource: item.wikiSource,
          targetRarity: item.targetRarity !== "AUTO" ? item.targetRarity : undefined,
          customPrompt: item.customPrompt,
        });

        setCandidates((prev) =>
          prev.map((c) =>
            c.id === item.id
              ? {
                  ...c,
                  status: "success",
                  generatedCardId: res.cardId,
                  mintedArtwork: (res as any).artworkUrl || item.imageUrl || null,
                  errorMessage: undefined,
                }
              : c
          )
        );
        successCount++;
      } catch (err: any) {
        const errorMsg = err?.message || "Generation failed";
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === item.id
              ? { ...c, status: "error", errorMessage: errorMsg }
              : c
          )
        );
        failCount++;
      }
    }

    setIsProcessingBatch(false);
    if (failCount > 0) {
      notify.warning(
        "Batch Completed with Errors",
        `Finished: ${successCount} minted, ${failCount} failed. Check the error reasons in the queue.`
      );
    } else {
      notify.success("Batch Process Complete", `All ${successCount} lore card(s) minted successfully.`);
    }
  };

  return (
    <FacetCard depth={2} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl space-y-6 text-card-foreground">
      {/* ─── Header & Sub-Tab Navigation Bar ────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 backdrop-blur-md">
            <BookOpen className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-foreground tracking-tight text-xl font-bold">
              Lore Card Batch Studio & Requests
            </h2>
            <p className="text-muted-foreground text-xs font-medium">
              AI wiki card generation, category preset crawlers, CSV/JSON bulk import, and request queue.
            </p>
          </div>
        </div>

        {/* Sub-Tab Switcher */}
        <FacetContainer depth={1} enableRefraction={true} className="bg-card/60 p-1 rounded-xl border border-border backdrop-blur-md flex items-center gap-1">
          <button
            onClick={() => setActiveTab("generator")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "generator"
                ? "bg-primary/15 border border-primary/40 text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Batch Studio ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "requests"
                ? "bg-primary/15 border border-primary/40 text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            User Queue ({requestStats.data?.pending ?? 0})
          </button>
        </FacetContainer>
      </div>

      {/* ─── TAB 1: BATCH GENERATOR STUDIO ──────────────────────────── */}
      {activeTab === "generator" && (
        <div className="space-y-6">
          {/* Global Parameter Controls */}
          <FacetContainer depth={1} enableRefraction={true} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-md space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sliders className="h-4 w-4 text-purple-500" />
              <span>Batch Generation Parameters</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {/* Wiki Source */}
              <div>
                <label className="text-muted-foreground text-[11px] font-medium block mb-1">
                  Default Wiki Source
                </label>
                <select
                  value={globalWikiSource}
                  onChange={(e) => setGlobalWikiSource(e.target.value as any)}
                  className="h-8.5 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ixwiki" className="bg-card text-card-foreground">IxWiki (Primary)</option>
                  <option value="iiwiki" className="bg-card text-card-foreground">IIWiki (Secondary)</option>
                </select>
              </div>

              {/* Target Rarity */}
              <div>
                <label className="text-muted-foreground text-[11px] font-medium block mb-1">
                  Target Rarity Strategy
                </label>
                <select
                  value={globalTargetRarity}
                  onChange={(e) => setGlobalTargetRarity(e.target.value as any)}
                  className="h-8.5 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="AUTO" className="bg-card text-card-foreground">Auto (AI-determined)</option>
                  <option value="COMMON" className="bg-card text-card-foreground">Common</option>
                  <option value="UNCOMMON" className="bg-card text-card-foreground">Uncommon</option>
                  <option value="RARE" className="bg-card text-card-foreground">Rare</option>
                  <option value="ULTRA_RARE" className="bg-card text-card-foreground">Ultra Rare</option>
                  <option value="EPIC" className="bg-card text-card-foreground">Epic</option>
                  <option value="LEGENDARY" className="bg-card text-card-foreground">Legendary</option>
                </select>
              </div>

              {/* Card Season */}
              <div>
                <label className="text-muted-foreground text-[11px] font-medium block mb-1">
                  Target Card Season
                </label>
                <select
                  value={globalSeason}
                  onChange={(e) => setGlobalSeason(parseInt(e.target.value, 10))}
                  className="h-8.5 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={1} className="bg-card text-card-foreground">Season 1</option>
                  <option value={2} className="bg-card text-card-foreground">Season 2</option>
                  <option value={3} className="bg-card text-card-foreground">Season 3</option>
                </select>
              </div>
            </div>
          </FacetContainer>

          {/* Quick Category Presets & Bulk Import Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-amber-500" /> Category Presets:
              </span>
              {CATEGORY_PRESETS.filter(
                (preset) =>
                  !(preset as any).wikiSourceFilter ||
                  (preset as any).wikiSourceFilter === globalWikiSource
              ).map((preset) => {
                const Icon = preset.icon;
                const isPresetCrawling = crawlingPresetName === preset.name;
                const stats =
                  categoryStatsData?.stats?.[preset.categoryName] ||
                  categoryStatsData?.stats?.[`Category:${preset.categoryName}`];
                const liveCount =
                  stats
                    ? stats.size || stats.pages + stats.files
                    : preset.categoryName === "IXWB"
                    ? 3371
                    : preset.terms.length;

                return (
                  <button
                    key={preset.name}
                    disabled={Boolean(crawlingPresetName)}
                    onClick={() => handleApplyPreset(preset)}
                    title={`Add all ${liveCount.toLocaleString()} verified ${preset.name} articles & files to batch queue\nCategory: Category:${preset.categoryName}\nSynonyms & Keywords: ${preset.synonyms.slice(0, 10).join(", ")}...`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all shadow-2xs disabled:opacity-60"
                  >
                    {isPresetCrawling ? (
                      <Loader2 className="h-3.5 w-3.5 text-purple-400 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5 text-purple-500" />
                    )}
                    <span>{preset.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md">
                      {isPresetCrawling ? "Crawling..." : liveCount.toLocaleString()}
                    </span>
                  </button>
                );
              })}

            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-xl border-border bg-card text-xs font-semibold text-foreground hover:bg-accent active:scale-95 transition-all"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV/JSON
              </Button>
              {candidates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportJSON}
                  className="h-8 rounded-xl border-border bg-card text-xs font-semibold text-foreground hover:bg-accent active:scale-95 transition-all"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export JSON
                </Button>
              )}
            </div>
          </div>

          {/* Live Wiki Category Search & Namespace 0 Crawlers */}
          <FacetContainer depth={1} enableRefraction={true} className="rounded-2xl border border-border bg-card/60 p-3.5 backdrop-blur-md space-y-3 shadow-xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Category Search Input with Autocomplete Dropdown */}
              <div className="relative flex-1">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={categorySearchQuery}
                    onChange={(e) => {
                      setCategorySearchQuery(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    placeholder={`Search ${globalWikiSource.toUpperCase()} categories (e.g. IXWB, Countries, Wars, Treaties)...`}
                    className="h-8.5 pl-8.5 pr-24 rounded-xl border-border bg-card/80 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
                  />
                  {categorySearchQuery.trim() && (
                    <Button
                      size="sm"
                      disabled={isCrawlingCategory}
                      onClick={() => handleCrawlCategory(categorySearchQuery)}
                      className="absolute right-1 h-6.5 rounded-lg px-2.5 text-[11px] font-semibold bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 active:scale-95 transition-all"
                    >
                      {isCrawlingCategory ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <BookOpen className="h-3 w-3 mr-1" />
                      )}
                      Crawl
                    </Button>
                  )}
                </div>

                {/* Dropdown suggestions */}
                {isCategoryDropdownOpen &&
                  categorySearchData?.categories &&
                  categorySearchData.categories.length > 0 && (
                    <div className="absolute left-0 right-0 top-10 z-50 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl space-y-0.5">
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground flex items-center justify-between border-b border-border/50 pb-1">
                        <span>Matching {globalWikiSource.toUpperCase()} Categories</span>
                        <button
                          onClick={() => setIsCategoryDropdownOpen(false)}
                          className="text-muted-foreground hover:text-foreground text-[10px] hover:underline"
                        >
                          Close
                        </button>
                      </div>
                      {categorySearchData.categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleCrawlCategory(cat)}
                          className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left text-foreground hover:bg-accent/80 transition-all group"
                        >
                          <span className="font-medium flex items-center gap-1.5">
                            <BookOpen className="h-3 w-3 text-purple-400" />
                            {cat}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                            Crawl Category →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Crawl All Namespace 0 (Main Pages) Action Button */}
              <Button
                size="sm"
                variant="outline"
                disabled={isCrawlingAllPages}
                onClick={handleCrawlAllMainPages}
                title={`Fetch all articles in the main namespace (namespace 0) on ${globalWikiSource.toUpperCase()}`}
                className="h-8.5 rounded-xl border-purple-500/40 bg-purple-500/10 text-xs font-semibold text-purple-400 hover:bg-purple-500/20 active:scale-95 transition-all shrink-0"
              >
                {isCrawlingAllPages ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="mr-1.5 h-3.5 w-3.5 text-purple-400" />
                )}
                Parse All {globalWikiSource.toUpperCase()} Main Pages (Namespace 0)
              </Button>
            </div>
          </FacetContainer>

          {/* Manual Input Box */}
          <FacetContainer depth={1} enableRefraction={true} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-foreground text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Add Articles & Categories to Queue (Comma or Newline Separated)
              </label>
              <Button
                size="sm"
                onClick={handleAddArticlesFromText}
                disabled={!articleInput.trim()}
                className="h-7 rounded-lg border border-primary/30 bg-primary/20 text-xs font-semibold text-primary hover:bg-primary/30 active:scale-95 transition-all"
              >
                Add to Queue
              </Button>
            </div>
            <textarea
              value={articleInput}
              onChange={(e) => setArticleInput(e.target.value)}
              placeholder="e.g. Caphiria, Daxia, Category:IXWB, Category:Wars, Category:Treaties, Urcea..."
              className="h-20 w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
            />
            <p className="text-[11px] text-muted-foreground">
              💡 Supports individual article titles, comma-separated lists, and <code className="text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded font-mono">Category:&lt;Name&gt;</code> to automatically crawl and load all member pages.
            </p>
          </FacetContainer>


          {/* Batch Candidate Queue Table */}
          {candidates.length > 0 && (
            <FacetContainer depth={1} enableRefraction={true} className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md shadow-inner space-y-3 p-4">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  <span className="text-foreground text-xs font-bold">
                    Batch Candidates Queue ({candidates.length})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Deduplicate Queue button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeduplicateQueue}
                    disabled={isProcessingBatch || candidates.length <= 1}
                    className="h-7.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-accent active:scale-95 transition-all shadow-xs"
                    title="Remove duplicate articles currently in this queue"
                  >
                    <Layers className="mr-1 h-3.5 w-3.5 text-purple-500" /> Deduplicate Queue
                  </Button>

                  {/* Purge Database Duplicates Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPurgeDialogOpen(true)}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all shadow-xs"
                    title="Scan and purge duplicate cards from the database"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Purge DB Duplicates ({duplicateStats?.totalDuplicates ?? 0})
                  </Button>

                  {/* Backfill Authors Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsBackfillDialogOpen(true)}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all shadow-xs"
                    title="Backfill page creator and contributor attribution for existing lore cards"
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5 text-amber-500" /> Backfill Wiki Authors
                  </Button>

                  {/* Re-Catalog Categories Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsReclassifyDialogOpen(true)}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all shadow-xs"
                    title="Re-scan and categorize lore cards with multi-signal infobox & category tree classifier"
                  >
                    <Layers className="mr-1 h-3.5 w-3.5 text-purple-500" /> Re-Catalog Categories
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCandidates([])}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg px-2 text-rose-500 hover:bg-rose-500/10 text-xs font-medium"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear All
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleProcessBatch}
                    disabled={isProcessingBatch || candidates.every((c) => c.status !== "idle")}
                    className="h-8 rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition-all shadow-xs"
                  >
                    {isProcessingBatch ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Generating Batch...
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Mint Batch Lore Cards ({candidates.filter((c) => c.status === "idle").length})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Queue Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("ALL")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    candidateStatusFilter === "ALL"
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  All ({candidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("idle")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    candidateStatusFilter === "idle"
                      ? "bg-muted text-foreground border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  Queued ({idleCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("generating")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    candidateStatusFilter === "generating"
                      ? "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  Generating ({generatingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("success")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    candidateStatusFilter === "success"
                      ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  Minted ({successCount})
                </button>
                {errorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setCandidateStatusFilter("error")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      candidateStatusFilter === "error"
                        ? "bg-rose-500/25 text-rose-500 border border-rose-500/40 shadow-xs"
                        : "text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/10"
                    }`}
                  >
                    Failed ({errorCount})
                  </button>
                )}
              </div>

              {/* Failed Imports Diagnostic Alert Banner */}
              {errorCount > 0 && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-600 dark:text-rose-400">
                        {errorCount} candidate{errorCount > 1 ? "s" : ""} failed during generation
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Common issues: Article missing on wiki, stub/short article, duplicate card, or API timeout.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyErrorReport}
                      className="h-7 text-[11px] font-semibold border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy Error Log
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearFailed}
                      className="h-7 text-[11px] font-semibold border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Clear Failed
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleRetryAllFailed}
                      disabled={isProcessingBatch}
                      className="h-7 text-[11px] font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-600 dark:text-rose-300 hover:bg-rose-500/30"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Retry All Failed ({errorCount})
                    </Button>
                  </div>
                </div>
              )}

              <div className="max-h-[440px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5 w-14 text-center">Artwork</th>
                      <th className="px-4 py-2.5">Article Title</th>
                      <th className="px-4 py-2.5">Source</th>
                      <th className="px-4 py-2.5">Target Rarity</th>
                      <th className="px-4 py-2.5">Season</th>
                      <th className="px-4 py-2.5">Status & Error Diagnostics</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCandidates.map((c) => {
                      const artworkToShow = c.mintedArtwork || c.imageUrl;
                      return (
                        <tr key={c.id} className="hover:bg-accent/40 transition-colors">
                          {/* Artwork Thumbnail / Clickable Image */}
                          <td className="px-3 py-2 text-center">
                            {artworkToShow ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    title: c.articleTitle,
                                    imageUrl: artworkToShow,
                                    extract: c.extract,
                                    wikiSource: c.wikiSource,
                                    category: c.category,
                                    rarity: c.targetRarity,
                                    season: c.season,
                                  })
                                }
                                className="group relative mx-auto h-10 w-10 overflow-hidden rounded-lg border border-border/80 bg-black/40 shadow-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                                title="Click to inspect full image"
                              >
                                <img
                                  src={artworkToShow}
                                  alt={c.articleTitle}
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye className="h-3.5 w-3.5 text-white" />
                                </div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    title: c.articleTitle,
                                    imageUrl: "",
                                    extract: c.extract,
                                    wikiSource: c.wikiSource,
                                    category: c.category,
                                    rarity: c.targetRarity,
                                    season: c.season,
                                  })
                                }
                                className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                                title="No primary image parsed. Click to inspect details"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </button>
                            )}
                          </td>

                          <td className="px-4 py-2.5 font-semibold text-foreground">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span>{c.articleTitle}</span>
                                {c.category && (
                                  <span className="rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.2 text-[8px] font-bold text-primary uppercase">
                                    {c.category}
                                  </span>
                                )}
                              </div>
                              {c.author && c.author !== "Unknown" && !c.author.toLowerCase().includes("community") && (
                                <span className="line-clamp-1 text-[10px] text-amber-500/90 font-medium">
                                  ✍️ {c.author}
                                </span>
                              )}
                              {c.extract && (!c.author || c.author === "Unknown" || c.author.toLowerCase().includes("community")) && (
                                <span className="line-clamp-1 text-[10px] text-muted-foreground font-normal">
                                  {c.extract}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {c.wikiSource === "iiwiki" ? (
                              <IIWikiBadge size="xs" />
                            ) : (
                              <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-bold text-foreground uppercase">
                                {c.wikiSource}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-300">
                              {c.targetRarity}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            S{c.season}
                          </td>
                          <td className="px-4 py-2.5">
                            {c.status === "generating" && (
                              <span className="inline-flex items-center gap-1 text-blue-500 font-semibold text-[11px]">
                                <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                              </span>
                            )}
                            {c.status === "success" && (
                              <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold text-[11px]">
                                <CheckCircle2 className="h-3 w-3" /> Minted ({c.generatedCardId?.slice(0, 8)})
                              </span>
                            )}
                            {c.status === "error" && (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedErrorCandidate(c)}
                                  className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 w-fit hover:bg-rose-500/25 transition-all cursor-pointer"
                                  title="Click to view full failure diagnostic"
                                >
                                  <XCircle className="h-3 w-3 text-rose-500" />
                                  Failed
                                </button>
                                {c.errorMessage && (
                                  <span
                                    onClick={() => setSelectedErrorCandidate(c)}
                                    className="text-[10px] text-rose-500/90 font-medium line-clamp-1 max-w-[240px] cursor-pointer hover:underline"
                                    title={c.errorMessage}
                                  >
                                    {c.errorMessage}
                                  </span>
                                )}
                              </div>
                            )}
                            {c.status === "idle" && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px]">
                                <Clock className="h-3 w-3" /> Queued
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {c.status === "error" && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryCandidate(c.id)}
                                  disabled={isProcessingBatch}
                                  className="rounded p-1 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer"
                                  title="Retry Import"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {artworkToShow && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      title: c.articleTitle,
                                      imageUrl: artworkToShow,
                                      extract: c.extract,
                                      wikiSource: c.wikiSource,
                                      category: c.category,
                                      rarity: c.targetRarity,
                                      season: c.season,
                                    })
                                  }
                                  className="rounded p-1 text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-all cursor-pointer"
                                  title="Inspect Artwork"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setCandidates((prev) => prev.filter((item) => item.id !== c.id))}
                                className="rounded p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                                title="Remove Candidate"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FacetContainer>
          )}

        </div>
      )}

      {/* ─── TAB 2: USER REQUEST QUEUE ──────────────────────────────── */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {/* Stats Bar */}
          {requestStats.data && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-border bg-card/70 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Total Requests</div>
                <div className="text-lg font-bold text-foreground mt-0.5">{requestStats.data.total}</div>
              </FacetCard>
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Pending Approval</div>
                <div className="text-lg font-bold text-amber-500 dark:text-amber-300 mt-0.5">{requestStats.data.pending}</div>
              </FacetCard>
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Generated Cards</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{requestStats.data.generated}</div>
              </FacetCard>
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Rejected</div>
                <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{requestStats.data.rejected}</div>
              </FacetCard>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Filter Queue:</span>
              <select
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
                className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition-all hover:bg-accent focus:outline-none"
              >
                <option value="ALL" className="bg-card text-card-foreground">All Requests</option>
                <option value="PENDING" className="bg-card text-card-foreground">Pending Only</option>
                <option value="APPROVED" className="bg-card text-card-foreground">Approved Only</option>
                <option value="GENERATED" className="bg-card text-card-foreground">Generated Only</option>
                <option value="REJECTED" className="bg-card text-card-foreground">Rejected Only</option>
              </select>
            </div>
          </div>

          {/* Request Queue Table */}
          {requestQueue.isLoading ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card/40 backdrop-blur-md">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !requestQueue.data || requestQueue.data.requests.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 backdrop-blur-md">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-1.5" />
              <p className="text-foreground text-sm font-semibold">No requests found in queue</p>
            </div>
          ) : (
            <FacetContainer depth={1} enableRefraction={true} className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md shadow-inner">
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Article Title</th>
                      <th className="px-4 py-3">Wiki Source</th>
                      <th className="px-4 py-3">Requester (Nation / User)</th>
                      <th className="px-4 py-3">Requested Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {requestQueue.data.requests.map((request: any) => {
                      const isPending = request.status === "PENDING";
                      const isApproved = request.status === "APPROVED";
                      const isGenerated = request.status === "GENERATED";
                      const isRejected = request.status === "REJECTED";

                      return (
                        <tr key={request.id} className="hover:bg-accent/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {request.articleTitle}
                          </td>
                          <td className="px-4 py-3">
                            {request.wikiSource === "iiwiki" ? (
                              <IIWikiBadge size="xs" />
                            ) : (
                              <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-bold text-foreground">
                                {request.wikiSource}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                              <UserCheck className="h-3 w-3" />
                              {request.requesterName || request.userId}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {isPending && (
                              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-500 dark:text-amber-300">
                                Pending
                              </span>
                            )}
                            {isApproved && (
                              <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-300">
                                Approved
                              </span>
                            )}
                            {isGenerated && (
                              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                                Generated
                              </span>
                            )}
                            {isRejected && (
                              <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => approveMutation.mutate({ requestId: request.id })}
                                    disabled={approveMutation.isPending}
                                    className="h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[11px] font-semibold"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRejectionRequestId(request.id)}
                                    className="h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 text-[11px] font-semibold"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {(isPending || isApproved) && (
                                <Button
                                  size="sm"
                                  onClick={() => generateRequestedMutation.mutate({ requestId: request.id })}
                                  disabled={generateRequestedMutation.isPending}
                                  className="h-7 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 text-[11px] font-semibold"
                                >
                                  Mint Card
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FacetContainer>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      <Dialog open={rejectionRequestId !== null} onOpenChange={(open) => !open && setRejectionRequestId(null)}>
        <DialogContent className="border border-border bg-card text-card-foreground shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Reject Lore Card Request & Refund 50 IxC?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Provide an optional reason for the user. The 50 IxC request fee will be automatically refunded to their vault.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection (e.g. Article non-existent or duplicate)"
            className="h-9 rounded-xl border-border bg-card text-xs text-foreground placeholder:text-muted-foreground"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionRequestId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (rejectionRequestId) {
                  rejectMutation.mutate({
                    requestId: rejectionRequestId,
                    reason: rejectionReason || undefined,
                  });
                }
              }}
              disabled={rejectMutation.isPending}
              className="bg-rose-500 text-white font-semibold hover:bg-rose-600"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Artwork & Image Inspector Lightbox Modal ──────────── */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl border border-border/80 bg-card/95 text-card-foreground backdrop-blur-2xl shadow-2xl p-0 overflow-hidden rounded-2xl">
          {previewImage && (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      {previewImage.title}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Parsed Wiki Artwork & Media Inspector
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewImage.wikiSource && (
                    <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-[10px] font-bold text-foreground uppercase font-mono">
                      {previewImage.wikiSource}
                    </span>
                  )}
                  {previewImage.rarity && (
                    <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-400">
                      {previewImage.rarity}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Image Stage */}
              <div className="relative flex min-h-[300px] max-h-[480px] w-full items-center justify-center bg-black/60 p-4 border-b border-border/60">
                {previewImage.imageUrl ? (
                  <img
                    src={previewImage.imageUrl}
                    alt={previewImage.title}
                    className="max-h-[420px] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
                    <ImageIcon className="h-12 w-12 stroke-[1.5] mb-2 opacity-50" />
                    <p className="text-xs">No primary artwork detected for this article</p>
                  </div>
                )}
              </div>

              {/* Details & Excerpt */}
              <div className="p-6 space-y-3">
                {previewImage.author && previewImage.author !== "Unknown" && !previewImage.author.toLowerCase().includes("community") && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                      Wiki Author:
                    </span>
                    <span className="font-semibold">{previewImage.author}</span>
                  </div>
                )}

                {previewImage.extract && (
                  <div className="rounded-xl bg-card/60 border border-border/60 p-3 text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto">
                    <p className="font-semibold text-foreground mb-1 text-[11px]">Article Summary:</p>
                    {previewImage.extract}
                  </div>
                )}

                {previewImage.imageUrl && (
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/40 px-3 py-2 text-[11px] font-mono">
                    <span className="truncate text-muted-foreground max-w-[400px]">
                      {previewImage.imageUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(previewImage.imageUrl);
                        notify.success("Copied", "Image URL copied to clipboard.");
                      }}
                      className="ml-2 flex items-center gap-1 text-primary hover:underline shrink-0 cursor-pointer font-sans"
                    >
                      <Copy className="h-3 w-3" /> Copy URL
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border/60 px-6 py-3.5 bg-card/40">
                {previewImage.wikiSource ? (
                  <a
                    href={
                      previewImage.wikiSource === "iiwiki"
                        ? `https://iiwiki.com/wiki/${encodeURIComponent(previewImage.title.replace(/ /g, "_"))}`
                        : `https://ixwiki.com/wiki/${encodeURIComponent(previewImage.title.replace(/ /g, "_"))}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View Wiki Article
                  </a>
                ) : (
                  <div />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewImage(null)}
                  className="rounded-xl border border-border text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Purge Duplicates Modal ──────────────────────────────── */}
      <Dialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
        <DialogContent className="max-w-xl border border-border/80 bg-card/95 text-card-foreground backdrop-blur-2xl shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                <Trash2 className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Purge Duplicate Cards ({duplicateStats?.totalDuplicates ?? 0} Redundant)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Safely consolidate duplicate cards and clean up redundant database copies.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                How Duplicate Purging Works:
              </p>
              <p className="text-[11px] leading-relaxed opacity-90">
                For each article with duplicate cards, the system selects the highest-level / most referenced card as the Primary Keeper. All user ownerships, auctions, and value history are re-linked to the keeper card before deleting redundant copies.
              </p>
            </div>

            {duplicateStats?.loreGroups && duplicateStats.loreGroups.length > 0 ? (
              <div className="space-y-2">
                <span className="font-semibold text-foreground block">
                  Duplicate Groups ({duplicateStats.loreGroups.length} unique articles):
                </span>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-card/60 divide-y divide-border/60">
                  {duplicateStats.loreGroups.map((g: { title: string; wikiSource: string; count: number; redundantCount: number }, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2.5">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{g.title}</p>
                        <span className="text-[10px] text-muted-foreground uppercase font-mono">
                          {g.wikiSource}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 text-[10px]">
                        {g.count} copies (+{g.redundantCount} redundant)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                <p className="font-semibold text-foreground">No Duplicate Lore Cards Found</p>
                <p className="text-[11px]">Your database is clean with no redundant lore card records.</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeDialogOpen(false)}
              className="rounded-xl border border-border text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={purgeDuplicatesMutation.isPending || (duplicateStats?.totalDuplicates ?? 0) === 0}
              onClick={() => purgeDuplicatesMutation.mutate({ mode: "wiki_lore" })}
              className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold active:scale-95 transition-all shadow-xs"
            >
              {purgeDuplicatesMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Purging...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Purge {duplicateStats?.totalDuplicates ?? 0} Duplicates
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Backfill Authors Modal ──────────────────────────────── */}
      <Dialog open={isBackfillDialogOpen} onOpenChange={setIsBackfillDialogOpen}>
        <DialogContent className="max-w-md border border-border/80 bg-card/95 text-card-foreground backdrop-blur-2xl shadow-2xl rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Backfill Wiki Authors
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Query MediaWiki API to parse and store creator & top contributor attribution on lore cards.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Wiki Source Selector */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <label className="text-foreground font-semibold block text-xs">Wiki Source:</label>
              <div className="flex items-center gap-2">
                {[
                  { id: "all", label: "All Sources" },
                  { id: "ixwiki", label: "IxWiki" },
                  { id: "iiwiki", label: "IIWiki" },
                ].map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setBackfillSource(src.id as "all" | "ixwiki" | "iiwiki")}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      backfillSource === src.id
                        ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Limit Selector */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <label className="text-foreground font-semibold block text-xs">Batch Limit:</label>
              <div className="flex items-center gap-2">
                {[50, 100, 250, 500].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBackfillLimit(num)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      backfillLimit === num
                        ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {num} Cards
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This will find lore cards from <strong className="text-foreground">{backfillSource === "all" ? "all wikis" : backfillSource.toUpperCase()}</strong> without saved <code className="text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded font-mono">authorInfo</code>, fetch their revision history to locate human page creators and top editors, and persist the attribution to the database.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBackfillDialogOpen(false)}
              className="rounded-xl border border-border text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={backfillAuthorsMutation.isPending}
              onClick={() => backfillAuthorsMutation.mutate({ limit: backfillLimit, wikiSource: backfillSource })}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold active:scale-95 transition-all shadow-xs"
            >
              {backfillAuthorsMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Backfilling...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Start Backfill ({backfillLimit})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Re-Catalog Categories Modal ──────────────────────────── */}
      <Dialog open={isReclassifyDialogOpen} onOpenChange={setIsReclassifyDialogOpen}>
        <DialogContent className="max-w-md bg-card/95 border-border/80 backdrop-blur-2xl p-6 rounded-3xl shadow-2xl space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5">
                <Layers className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Re-Catalog Lore Categories
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Re-evaluate existing lore cards using Infobox template and category tree scoring.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Wiki Source Selector */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <label className="text-foreground font-semibold block text-xs">Wiki Source:</label>
              <div className="flex items-center gap-2">
                {[
                  { id: "all", label: "All Sources" },
                  { id: "ixwiki", label: "IxWiki" },
                  { id: "iiwiki", label: "IIWiki" },
                ].map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setReclassifySource(src.id as "all" | "ixwiki" | "iiwiki")}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      reclassifySource === src.id
                        ? "border-purple-500 bg-purple-500/20 text-purple-600 dark:text-purple-300"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Limit Selector */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <label className="text-foreground font-semibold block text-xs">Batch Limit:</label>
              <div className="flex items-center gap-2">
                {[50, 100, 250, 500].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setReclassifyLimit(num)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      reclassifyLimit === num
                        ? "border-purple-500 bg-purple-500/20 text-purple-600 dark:text-purple-300"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {num} Cards
                  </button>
                ))}
              </div>
            </div>

            {/* Overwrite Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3">
              <div>
                <span className="text-foreground font-semibold block text-xs">Force Overwrite</span>
                <span className="text-muted-foreground text-[10px]">Re-classify all cards, not just unclassified/defaults</span>
              </div>
              <input
                type="checkbox"
                checked={reclassifyForce}
                onChange={(e) => setReclassifyForce(e.target.checked)}
                className="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500"
              />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This will analyze lore cards from <strong className="text-foreground">{reclassifySource === "all" ? "all wikis" : reclassifySource.toUpperCase()}</strong> against the 12 canonical LoreCategory enums, matching infobox types (e.g. officeholders, treaties, battles, settlements) and persisting accurate category seals.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReclassifyDialogOpen(false)}
              className="rounded-xl border border-border text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={reclassifyCategoriesMutation.isPending}
              onClick={() =>
                reclassifyCategoriesMutation.mutate({
                  limit: reclassifyLimit,
                  wikiSource: reclassifySource,
                  forceOverwrite: reclassifyForce,
                })
              }
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold active:scale-95 transition-all shadow-xs"
            >
              {reclassifyCategoriesMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Classifying...
                </>
              ) : (
                <>
                  <Layers className="mr-1.5 h-3.5 w-3.5" /> Start Re-Catalog ({reclassifyLimit})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detailed Error Diagnostic Dialog ─────────────────────── */}
      <Dialog
        open={!!selectedErrorCandidate}
        onOpenChange={(isOpen) => !isOpen && setSelectedErrorCandidate(null)}
      >
        <DialogContent className="max-w-md bg-card/95 border-border/80 backdrop-blur-2xl p-6 rounded-3xl shadow-2xl space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <DialogTitle className="text-foreground tracking-tight text-base font-bold">
                  Import Failure Diagnostics
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Troubleshooting details for why this lore card failed to generate.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedErrorCandidate && (
            <div className="space-y-3 py-1 text-xs">
              <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Article Title:</span>
                  <span className="font-bold text-foreground">{selectedErrorCandidate.articleTitle}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Wiki Source:</span>
                  <span className="font-bold uppercase text-foreground">{selectedErrorCandidate.wikiSource}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Target Rarity:</span>
                  <span className="font-bold text-purple-400">{selectedErrorCandidate.targetRarity}</span>
                </div>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-1.5">
                <div className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                  <XCircle className="h-4 w-4 text-rose-500" /> Error Reason
                </div>
                <div className="font-mono text-[11px] text-rose-700 dark:text-rose-300 break-words whitespace-pre-wrap leading-relaxed">
                  {selectedErrorCandidate.errorMessage || "Unknown error occurred during generation."}
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-card/60 p-3 space-y-1 text-muted-foreground text-[11px]">
                <div className="font-semibold text-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-primary" /> Troubleshooting Tips:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 mt-1">
                  <li>Verify article spelling, casing, and underscores on {selectedErrorCandidate.wikiSource.toUpperCase()}.</li>
                  <li>Ensure the article has sufficient prose content (not an empty stub or redirect).</li>
                  <li>Check if a card for this article title already exists in the database.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedErrorCandidate(null)}
              className="rounded-xl border border-border text-xs"
            >
              Close
            </Button>
            {selectedErrorCandidate && (
              <Button
                size="sm"
                onClick={() => {
                  const id = selectedErrorCandidate.id;
                  setSelectedErrorCandidate(null);
                  void handleRetryCandidate(id);
                }}
                disabled={isProcessingBatch}
                className="rounded-xl bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition-all shadow-xs"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry Import Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FacetCard>
  );
}

