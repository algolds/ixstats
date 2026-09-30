import fs from "fs";
import path from "path";
import * as Iconoir from "iconoir-react";

const ICONOIR_EXPORTS = new Set(Object.keys(Iconoir));

export const ICON_MAP = {
  // Navigation & Chevrons / Arrows
  ChevronDown: "NavArrowDown",
  ChevronUp: "NavArrowUp",
  ChevronLeft: "NavArrowLeft",
  ChevronRight: "NavArrowRight",
  ChevronDownIcon: "NavArrowDown",
  ChevronUpIcon: "NavArrowUp",
  ChevronLeftIcon: "NavArrowLeft",
  ChevronRightIcon: "NavArrowRight",
  ChevronsUpDown: "ArrowSeparateVertical",
  ChevronsRight: "NavArrowRight",
  ChevronsLeft: "NavArrowLeft",
  ChevronsUp: "NavArrowUp",
  ChevronsDown: "NavArrowDown",
  ChevronsDownUp: "ArrowSeparateVertical",
  ArrowUpDown: "ArrowSeparateVertical",
  ArrowRightLeft: "ArrowSeparate",
  ArrowLeftRight: "ArrowSeparate",
  ArrowRight: "ArrowRight",
  ArrowLeft: "ArrowLeft",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowUpRight: "ArrowUpRight",
  ArrowDownRight: "ArrowDownRight",
  ArrowUpLeft: "ArrowUpLeft",
  ArrowDownLeft: "ArrowDownLeft",
  ArrowUpCircle: "ArrowUpCircle",
  CornerDownRight: "CornerBottomRight",
  CornerDownLeft: "CornerBottomLeft",
  CornerUpRight: "CornerTopRight",
  CornerUpLeft: "CornerTopLeft",
  MoveRight: "ArrowRight",
  MoveLeft: "ArrowLeft",
  MoveUp: "ArrowUp",
  MoveDown: "ArrowDown",
  Move: "ArrowSeparate",

  // Window / Close / Actions / Controls
  X: "Xmark",
  XIcon: "Xmark",
  XCircle: "XmarkCircle",
  Plus: "Plus",
  PlusCircle: "PlusCircle",
  Minus: "Minus",
  MinusCircle: "MinusCircle",
  Check: "Check",
  CheckIcon: "Check",
  CheckCircle: "CheckCircle",
  CheckCircle2: "CheckCircle",
  CheckCheck: "CheckCircle",
  CheckSquare: "CheckSquare",
  Square: "Square",
  Circle: "Circle",
  CircleDot: "CircleDot",
  RefreshCw: "Refresh",
  RotateCw: "Refresh",
  RotateCcw: "Undo",
  Undo: "Undo",
  Undo2: "Undo",
  Redo: "Redo",
  Redo2: "Redo",
  Repeat: "Refresh",
  Repeat2: "Refresh",
  Loader: "SystemRestart",
  Loader2: "SystemRestart",
  Loading: "SystemRestart",
  Save: "FloppyDisk",
  Sliders: "ControlSlider",
  SlidersHorizontal: "ControlSlider",
  SlidersVertical: "ControlSlider",
  Filter: "Filter",
  FilterX: "Filter",
  ListFilter: "FilterList",
  ToggleLeft: "ToggleOff",
  ToggleRight: "ToggleOn",
  Lock: "Lock",
  Unlock: "LockSlash",
  Key: "Key",
  Command: "KeyCommand",
  Terminal: "Terminal",
  Code: "Code",
  Code2: "Code",
  Cpu: "Cpu",
  Database: "Database",
  Server: "Server",
  HardDrive: "HardDrive",
  Layers: "Component",
  LayoutGrid: "ViewGrid",
  LayoutDashboard: "Dashboard",
  Layout: "ViewGrid",
  LayoutList: "List",
  Grid: "ViewGrid",
  Grid3x3: "ViewGrid",
  Grid3X3: "ViewGrid",
  List: "List",
  ListOrdered: "NumberedListLeft",
  ListTree: "NumberedListLeft",
  Table: "Table",
  MoreHorizontal: "MoreHoriz",
  MoreVertical: "MoreVert",
  GripVertical: "Menu",
  Menu: "Menu",
  Clock: "Clock",
  Timer: "Timer",
  Hourglass: "Hourglass",
  Calendar: "Calendar",
  CalendarIcon: "Calendar",
  CalendarCheck: "CalendarCheck",
  CalendarClock: "CalendarRotate",
  CalendarDays: "Calendar",
  Trash: "Trash",
  Trash2: "Trash",
  Edit: "EditPencil",
  Edit2: "EditPencil",
  Edit3: "EditPencil",
  Pencil: "EditPencil",
  PenLine: "EditPencil",
  PenTool: "EditPencil",
  PenSquare: "EditPencil",
  Wrench: "Wrench",
  Hammer: "Hammer",
  Gavel: "Hammer",
  Pickaxe: "Hammer",
  Flag: "WhiteFlag",
  TriangleFlag: "TriangleFlag",
  Tag: "Tag",
  Tags: "Tags",
  Hash: "Hashtag",
  Dices: "DiceSix",
  Dice1: "DiceOne",
  Dice2: "DiceTwo",
  Dice3: "DiceThree",
  Dice4: "DiceFour",
  Dice5: "DiceFive",
  Dice6: "DiceSix",
  Quote: "Quote",
  GitBranch: "GitBranch",
  GitCommit: "GitCommit",
  GitMerge: "GitMerge",
  GitPullRequest: "GitPullRequest",
  GitFork: "GitFork",
  GitCompare: "GitCompare",
  Expand: "Expand",
  Maximize: "Expand",
  Maximize2: "Expand",
  Minimize: "Compress",
  Minimize2: "Compress",
  UnfoldHorizontal: "ExpandLines",
  FoldHorizontal: "CompressLines",
  LogOut: "LogOut",
  LogIn: "LogIn",
  Power: "OffTag",
  PowerOff: "OffTag",
  Sun: "SunLight",
  SunDim: "SunLight",
  SunMoon: "HalfMoon",
  Moon: "HalfMoon",
  Cloud: "Cloud",
  CloudSun: "CloudSun",
  CloudRain: "CloudRain",
  Umbrella: "Umbrella",
  Droplet: "Droplet",
  Droplets: "Droplet",
  Wind: "Wind",
  Flame: "FireFlame",
  Sparkles: "Sparks",
  Sparkle: "Sparks",
  Wand2: "MagicWand",
  Zap: "Flash",
  ZapOff: "FlashOff",
  Equal: "Minus",
  Replace: "Refresh",
  Split: "GitBranch",
  Merge: "GitMerge",
  Scaling: "Expand",
  ZoomIn: "ZoomIn",
  Crosshair: "Archery",
  Radar: "Archery",
  LocateFixed: "Pin",
  MousePointer2: "CursorPointer",
  MousePointerClick: "CursorPointer",
  LassoSelect: "SelectWindow",
  Copy: "Copy",
  CopyPlus: "Copy",
  CopyCheck: "Copy",
  Scissors: "Cut",
  Paste: "PasteClipboard",

  // People, Roles & Identity
  User: "User",
  UserCheck: "UserBadgeCheck",
  UserPlus: "UserPlus",
  UserMinus: "UserXmark",
  UserX: "UserXmark",
  UserCog: "User",
  Users: "Group",
  Users2: "Group",
  Crown: "Crown",
  CrownIcon: "Crown",
  Baby: "Lullaby",
  Heart: "Heart",
  HeartHandshake: "UserLove",
  HeartPulse: "Heart",
  Handshake: "Community",
  HandshakeIcon: "Community",
  Hand: "HandBrake",
  Smile: "Emoji",
  Angry: "Emoji",
  Ghost: "Ghost",
  Bot: "Cpu",
  Fingerprint: "Fingerprint",

  // Places, Geography & Nature
  Building: "Building",
  Building2: "City",
  Landmark: "Bank",
  Home: "HomeSimple",
  Globe: "Globe",
  Globe2: "Globe",
  Map: "Map",
  MapIcon: "Map",
  MapPin: "MapPin",
  Pin: "Pin",
  Compass: "Compass",
  Navigation: "Navigator",
  Mountain: "ModernTv",
  Leaf: "Leaf",
  TreePine: "Forest",
  Trees: "Forest",
  Wheat: "Farm",
  Flower2: "Flower",
  Fish: "Fish",
  LandPlot: "Map",
  Waves: "SeaWaves",
  Ship: "DeliveryTruck",
  ShipWheel: "Navigator",
  Anchor: "SeaWaves",
  LifeBuoy: "HelpCircle",

  // Economy, Commerce, Wealth & Metrics
  DollarSign: "Dollar",
  CircleDollarSign: "Dollar",
  BadgeDollarSign: "Dollar",
  Banknote: "Dollar",
  Coins: "Coins",
  Wallet: "Wallet",
  CreditCard: "CreditCard",
  Receipt: "Receipt",
  Percent: "Percentage",
  Percentage: "Percentage",
  TrendingUp: "StatUp",
  TrendingDown: "StatDown",
  BarChart: "StatsReport",
  BarChart2: "StatsReport",
  BarChart3: "StatsReport",
  BarChart3Icon: "StatsReport",
  LineChart: "GraphUp",
  ChartLine: "GraphUp",
  PieChart: "Reports",
  PieChartIcon: "Reports",
  Activity: "Activity",
  Calculator: "Calculator",
  Scale: "ScaleFrameEnlarge",
  Briefcase: "Suitcase",
  BriefcaseBusiness: "Suitcase",
  Factory: "Industry",
  Store: "Shop",
  ShoppingCart: "Cart",
  ShoppingBag: "ShoppingBag",
  Package: "Package",
  Box: "Package",
  Gift: "Gift",
  Gem: "Crown",
  Diamond: "Crown",
  Trophy: "Trophy",
  Medal: "Medal",
  Award: "Trophy",
  Star: "Star",
  StarOff: "Star",
  BadgeCheck: "CheckCircle",
  Gauge: "Dashboard",
  GaugeCircle: "Dashboard",
  Thermometer: "Dashboard",
  Fuel: "GasStation",
  SortAsc: "SortUp",
  SortDesc: "SortDown",
  Sigma: "Calculator",

  // Law, Defense & Intelligence
  Shield: "Shield",
  ShieldAlert: "ShieldAlert",
  ShieldCheck: "ShieldCheck",
  ShieldX: "ShieldAlert",
  ShieldQuestion: "ShieldQuestion",
  Sword: "Tournament",
  Swords: "Tournament",
  Siren: "BellNotification",
  AlertCircle: "WarningCircle",
  AlertTriangle: "WarningTriangle",
  AlertOctagon: "WarningTriangle",
  Ban: "Forbidden",
  Target: "Archery",
  Vote: "CheckSquare",
  Church: "Church",
  Cross: "PharmacyCrossCircle",

  // Communications & Feed
  Bell: "Bell",
  BellOff: "BellOff",
  BellRing: "BellNotification",
  MessageSquare: "ChatBubble",
  MessageCircle: "ChatBubble",
  MessagesSquare: "ChatLines",
  Send: "Send",
  Reply: "Reply",
  Share: "ShareAndroid",
  Share2: "ShareAndroid",
  Rss: "RssFeed",
  Mail: "Mail",
  Inbox: "Inbox",
  Phone: "Phone",
  Radio: "Radio",
  Wifi: "Wifi",
  WifiOff: "WifiOff",
  Network: "Network",
  ThumbsUp: "ThumbsUp",
  ThumbsDown: "ThumbsDown",

  // Documents, Media & Tools
  File: "Page",
  FileText: "Page",
  FileCheck: "PageCheck",
  FilePlus: "PagePlus",
  FileCode: "Code",
  FileCode2: "Code",
  FileClock: "ClockRotateRight",
  FileImage: "MediaImage",
  FileEdit: "PageEdit",
  FileDown: "Download",
  FileUp: "Upload",
  FileSpreadsheet: "Table",
  Folder: "Folder",
  FolderOpen: "FolderOpen",
  FolderPlus: "FolderPlus",
  FolderHeart: "Folder",
  FolderTree: "Folder",
  FolderDown: "Folder",
  Archive: "Archive",
  BookOpen: "OpenBook",
  Book: "Book",
  BookMarked: "Bookmark",
  Bookmark: "Bookmark",
  BookmarkPlus: "Bookmark",
  Library: "BookStack",
  Newspaper: "Journal",
  ScrollText: "Page",
  Scroll: "Page",
  Paperclip: "Attachment",
  Clipboard: "PasteClipboard",
  ClipboardCheck: "TaskCheck",
  ClipboardList: "TaskList",
  ClipboardSignature: "PasteClipboard",
  Download: "Download",
  Upload: "Upload",
  ExternalLink: "OpenNewWindow",
  ExternalLinkIcon: "OpenNewWindow",
  Link: "Link",
  Link2: "Link",
  Link2Off: "Unlink",
  Unlink: "Unlink",
  Eye: "Eye",
  EyeOff: "EyeClosed",
  ScanEye: "ScanQrCode",
  Image: "MediaImage",
  ImageIcon: "MediaImage",
  ImageOff: "MediaImage",
  Camera: "Camera",
  Video: "VideoCamera",
  Film: "Film",
  Music: "MusicDoubleNote",
  ListMusic: "Playlist",
  Mic: "Microphone",
  Volume1: "SoundLow",
  Volume2: "SoundHigh",
  VolumeX: "SoundOff",
  AudioLines: "SoundHigh",
  AudioWaveform: "SoundHigh",
  Headphones: "Headset",
  Disc: "Cd",
  Play: "Play",
  PlayCircle: "Play",
  Pause: "Pause",
  PauseCircle: "Pause",
  FastForward: "FastArrowRight",
  SkipForward: "FastArrowRight",
  SkipBack: "FastArrowLeft",
  Info: "InfoCircle",
  InfoIcon: "InfoCircle",
  HelpCircle: "HelpCircle",
  CircleHelp: "HelpCircle",
  Palette: "Palette",
  Paintbrush: "ColorPicker",
  PaintBucket: "ColorPicker",
  Pipette: "ColorPicker",
  PipetteIcon: "ColorPicker",
  ColorPicker: "ColorPicker",
  Printer: "Printer",
  Cookie: "Cookie",
  GraduationCap: "GraduationCap",
  Stethoscope: "Healthcare",
  Atom: "Atom",
  Microscope: "Microscope",
  FlaskConical: "Flask",
  Beaker: "Flask",
  Rocket: "Rocket",
  Truck: "DeliveryTruck",
  Car: "Car",
  Train: "Train",
  Plane: "Plane",
  Ticket: "Ticket",
  Dumbbell: "Gym",
  Gamepad2: "Gamepad",
  Puzzle: "Puzzle",
  Blocks: "Component",
  Shapes: "Component",
  Type: "Type",
  Underline: "Underline",
  Bold: "Bold",
  Italic: "Italic",
  Heading2: "TextSize",
  Heading3: "TextSize",
  AlignLeft: "AlignLeft",
  AlignRight: "AlignRight",
  Ruler: "Ruler",
  Languages: "Translate",
  Search: "Search",
  SearchIcon: "Search",
  Settings: "Settings",
  Settings2: "Settings",
  Cog: "Settings",
  Keyboard: "Keyframe",
  Binary: "Code",
  CircuitBoard: "Cpu",
  Theater: "ViewGrid",
  Drama: "Emoji",
  Shirt: "Shop",
  Pizza: "Shop",
  Apple: "Apple",
  Wine: "GlassWine",
  GlassWater: "GlassWine",
  Guitar: "MusicDoubleNote",
  UtensilsCrossed: "Cutlery",
  Recycle: "SystemRestart",
  Magnet: "Magnet",
  Hexagon: "Hexagon",
  Skull: "Emoji",
  Cat: "Emoji",
  Bird: "Eye",
  Rabbit: "Eye",
  Copyright: "Copyright",
};

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".git") {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

export function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("lucide-react")) return false;

  // 1. Namespace imports: import * as LucideIcons from "lucide-react"
  content = content.replace(
    /import\s+\*\s+as\s+LucideIcons\s+from\s+["']lucide-react["'];?/g,
    'import * as IconoirIcons from "iconoir-react";'
  );
  content = content.replace(/\bLucideIcons\b/g, "IconoirIcons");

  // 2. Named imports: import { ... } from "lucide-react"
  const importRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']lucide-react["'];?/g;

  content = content.replace(importRegex, (match, importGroup) => {
    // Strip comments if any
    const cleanGroup = importGroup.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const items = cleanGroup
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const converted = [];
    for (const item of items) {
      if (item === "type LucideIcon" || item === "LucideIcon") {
        continue;
      }
      // Handle alias: Foo as Bar
      const parts = item.split(/\s+as\s+/);
      const name = parts[0].trim();
      const alias = parts[1] ? parts[1].trim() : null;

      const target = ICON_MAP[name] || (ICONOIR_EXPORTS.has(name) ? name : null);
      if (!target) {
        console.warn(`Unmapped icon in ${filePath}: "${name}"`);
        converted.push(item);
        continue;
      }

      if (alias) {
        if (target === alias) {
          converted.push(target);
        } else {
          converted.push(`${target} as ${alias}`);
        }
      } else {
        if (target === name) {
          converted.push(name);
        } else {
          converted.push(`${target} as ${name}`);
        }
      }
    }

    if (converted.length === 0) {
      return "";
    }
    return `import { ${converted.join(", ")} } from "iconoir-react";`;
  });

  // 3. LucideIcon references in types
  content = content.replace(/\bLucideIcon\b/g, "React.ComponentType<{ className?: string }>");

  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

const target = process.argv[2] || "src";
const allFiles = getAllFiles(path.resolve(target));
let count = 0;
for (const file of allFiles) {
  if (migrateFile(file)) {
    count++;
  }
}
console.log(`Migrated ${count} files in ${target}`);
