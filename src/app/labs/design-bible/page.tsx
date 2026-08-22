"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  BookOpen,
  Layers,
  Calendar,
  FileText,
  GitBranch,
  Sliders,
  Cpu,
  Sparkles,
  Search,
  Compass,
  FileCode,
  User,
  History,
  AlertOctagon,
  Globe,
  Activity,
  Terminal,
  Maximize2,
  Minimize2,
  Network,
  Radar,
  TrendingUp,
} from "lucide-react";
import { FacetContainer, FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

// React Flow imports
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Custom node component for the visualizer
function SystemNode({ data }: any) {
  return (
    <div
      className={`bg-card/95 relative w-[180px] rounded-xl border p-3 text-left shadow-md ${data.borderColor}`}
    >
      {/* Inputs on the left and top */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="h-1.5 w-1.5 bg-slate-400 opacity-40"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="h-1.5 w-1.5 bg-slate-400 opacity-40"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="h-1.5 w-1.5 bg-slate-400 opacity-40"
      />

      <div className="mb-1 flex items-center gap-1.5">
        {data.icon}
        <span className="text-foreground text-[11px] leading-tight font-bold">{data.title}</span>
      </div>
      <p className="text-muted-foreground text-[9px] leading-normal">{data.description}</p>

      {/* Outputs on the right and bottom */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="h-1.5 w-1.5 bg-slate-400 opacity-40"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="h-1.5 w-1.5 bg-slate-400 opacity-40"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="h-1.5 w-1.5 bg-slate-400 opacity-40"
      />
    </div>
  );
}

// Sub-node component representing components under main backend systems
function SubNode({ data }: any) {
  return (
    <div
      className={`bg-card/90 relative w-[160px] rounded-lg border-2 border-dashed p-2.5 text-left shadow-md ${data.borderColor}`}
    >
      <Handle type="target" position={Position.Left} className="h-1 w-1 bg-slate-400 opacity-40" />
      <div className="mb-1 flex items-center gap-1.5">
        <span className="bg-muted text-muted-foreground border-border rounded border px-1.5 py-0.5 text-[8px] font-extrabold uppercase">
          {data.subType}
        </span>
      </div>
      <h5 className="text-foreground font-mono text-[10px] leading-tight font-bold tracking-tight">
        {data.title}
      </h5>
      <p className="text-muted-foreground mt-1 text-[9px] leading-normal">{data.description}</p>
      <Handle type="source" position={Position.Right} className="h-1 w-1 bg-slate-400 opacity-40" />
    </div>
  );
}

const nodeTypes = {
  system: SystemNode,
  sub: SubNode,
};

// Metadata for the loop breakdown inspector
const loopBreakdowns: Record<
  string,
  {
    title: string;
    description: string;
    steps: string[];
    verbs: string[];
    mechanics: string;
  }
> = {
  l1: {
    title: "Macro Loop",
    description: "The primary engine of governance that sets the direction of the state.",
    steps: [
      "Vision Setup: Player chooses a long-term Vision (e.g. Maritime superpower).",
      "Agenda Setting: Executive selects Strategic Objectives matching the Vision.",
      "Commitment: Cabinet authorizes resources (CivCap, budget) to active intents.",
      "Emergence: Factions, neighboring states, and the environment push back.",
      "Timeline Entry: Outcomes are committed to the national history ledger.",
    ],
    verbs: ["Declare", "Authorize", "Remember"],
    mechanics:
      "Processes active intent nodes, checks prerequisite statuses, and triggers the timeline logger.",
  },
  l2: {
    title: "Legislature Loop",
    description: "Continuous legislative cycle where elections act as checkpoint transitions.",
    steps: [
      "Agenda Setting: Player drafts bills as intent commitments.",
      "Bargaining: Coalitions trade votes and compromise on manifesto red lines.",
      "Floor Vote: Parliament votes based on party seat weight.",
      "Emergent Elections: Seats are redistributed automatically based on timeline outcomes.",
    ],
    verbs: ["Declare", "Negotiate", "Authorize"],
    mechanics:
      "Calculates party platform alignment, tracks red lines, and runs seats redistribution math.",
  },
  l3: {
    title: "Meeting Loop",
    description:
      "Playable deliberation where cabinet portfolios resolve options and recommendations.",
    steps: [
      "Trigger: Need arises from an issue, crisis, or opportunity.",
      "Preparation: Ministries compile briefing data using CivCap.",
      "Deliberation: Cabinet ministers argue, Power Brokers lobby.",
      "Decision: Player selects Option A, B, C, or D.",
      "Commitment: The choice instantiates a new operational node.",
    ],
    verbs: ["Convene", "Negotiate", "Authorize"],
    mechanics:
      "Calculates preparation levels, Minister alignments, and outputs dynamic Plan arrays.",
  },
  l4: {
    title: "Policy Loop",
    description: "Departmental execution of cabinet commitments.",
    steps: [
      "Drafting: Ministry portfolios map costs and requirements.",
      "Enactment: Passed bill or executive order moves policy to active.",
      "Execution: Department efficiency determines information fog levels.",
      "Review: Player inspects efficacy and adjusts CivCap upkeep.",
    ],
    verbs: ["Declare", "Authorize", "Review"],
    mechanics:
      "Applies qualitative cost/benefit masking under low efficiency (<45%) and manages CivCap upkeeps.",
  },
  l5: {
    title: "Regional Loop",
    description: "Spatial need fulfillment and infrastructure planning.",
    steps: [
      "Deficit Identification: Spatial map indicators flag transport/housing needs.",
      "Local Planning: Public works draft local infrastructure proposals.",
      "Investment: Player authorizes budget allocation.",
      "Resistance: Local groups file planning lawsuits or broker strikes.",
    ],
    verbs: ["Declare", "Convene", "Authorize"],
    mechanics:
      "Reads map layer cells, updates procedural region structures, and schedules development completions.",
  },
  l6: {
    title: "Foreign Affairs Loop",
    description: "Diplomatic summits and resource-consuming embassy operations.",
    steps: [
      "Embassy Activation: Player funds local missions with budget/CivCap.",
      "Mission Selection: Visa processing, trade agreements, or intelligence gathering.",
      "Summits: International summits convened to draft alliances.",
      "Treaty Commitment: Pact reserves constant CivCap and decays if ignored.",
    ],
    verbs: ["Convene", "Negotiate", "Review"],
    mechanics:
      "Runs diplomatic summits via CabinetMeeting engine and calculates treaty alignment decay.",
  },
  l7: {
    title: "Crisis Loop",
    description: "Time-sensitive emergency triage response.",
    steps: [
      "Shock: High-priority issue alerts bubble to Dashboard.",
      "Triage Cabinet: Zero-preparation cabinet meeting convened.",
      "Emergency Plan D: High-cost, high-risk executive options authorized.",
      "Aftermath: Timeline registers results and starts public inquiries.",
    ],
    verbs: ["Convene", "Authorize", "Remember"],
    mechanics:
      "Overrides standard preparation phase, locks out standard plans, and applies maximum timeline weights.",
  },
  l8: {
    title: "Opportunity Loop",
    description: "Favorable windfalls prompting strategic adjustments.",
    steps: [
      "Detection: Development completions or diplomatic openings create a window.",
      "Deliberation: Planning board assesses potential gains.",
      "Milestone Lock-in: Authorizing new Strategic Objectives in the DAG.",
      "Adaptation: Operational tasks execute to secure the payoff.",
    ],
    verbs: ["Declare", "Convene", "Authorize"],
    mechanics:
      "Temporarily unlocks restricted intent nodes and maps specialized prerequisite edges.",
  },
  l9: {
    title: "Legacy Loop",
    description: "Writing national identity into history.",
    steps: [
      "Completion: Intent DAG node reaches successful/failed terminal state.",
      "Timeline Ledger: Log entries commit via CountryEventSpine.",
      "WikiOS Entry: Records written directly into public wiki files.",
      "Era Definition: National traits adjust based on accumulation of records.",
    ],
    verbs: ["Review", "Remember"],
    mechanics:
      "Writes database history records and maps player choices to persistent global Wiki pages.",
  },
};

// Sub-nodes configuration maps for Backend Connections
const backendSubNodes: Record<
  string,
  Array<{
    id: string;
    title: string;
    subType: "Prisma Model" | "tRPC API" | "Service";
    description: string;
    offset: { x: number; y: number };
  }>
> = {
  b1: [
    {
      id: "b1-sub1",
      title: "NationalVision",
      subType: "Prisma Model",
      description: "Configures long-term identity and traits.",
      offset: { x: 230, y: -90 },
    },
    {
      id: "b1-sub2",
      title: "getIntentsGraph",
      subType: "tRPC API",
      description: "Query to render visual DAG nodes.",
      offset: { x: 230, y: 10 },
    },
    {
      id: "b1-sub3",
      title: "declareIntent",
      subType: "tRPC API",
      description: "Mutation initializing a new proposed intent.",
      offset: { x: 230, y: 110 },
    },
  ],
  b2: [
    {
      id: "b2-sub1",
      title: "NationalIntent",
      subType: "Prisma Model",
      description: "Tracks intent layers, states, and resource costs.",
      offset: { x: 230, y: -90 },
    },
    {
      id: "b2-sub2",
      title: "IntentDependency",
      subType: "Prisma Model",
      description: "Resolves prerequisite and blocker self-relations.",
      offset: { x: 230, y: 10 },
    },
    {
      id: "b2-sub3",
      title: "deliberateOptions",
      subType: "tRPC API",
      description: "Generates tailored recommendation Plan vectors.",
      offset: { x: 230, y: 110 },
    },
  ],
  b3: [
    {
      id: "b3-sub1",
      title: "CabinetMeeting",
      subType: "Prisma Model",
      description: "Tracks scheduled sessions, agendas, and logs.",
      offset: { x: 230, y: -70 },
    },
    {
      id: "b3-sub2",
      title: "MeetingParticipant",
      subType: "Prisma Model",
      description: "Stores attendee influence, expertise, and alignments.",
      offset: { x: 230, y: 30 },
    },
    {
      id: "b3-sub3",
      title: "conveneMeeting",
      subType: "tRPC API",
      description: "Mutation starting briefing compilation ticks.",
      offset: { x: 230, y: 130 },
    },
  ],
  b4: [
    {
      id: "b4-sub1",
      title: "Embassy",
      subType: "Prisma Model",
      description: "Tracks local missions and allocated CivCap.",
      offset: { x: 230, y: -50 },
    },
    {
      id: "b4-sub2",
      title: "PoliticalParty",
      subType: "Prisma Model",
      description: "Stores platform manifestos, seats, and red lines.",
      offset: { x: 230, y: 50 },
    },
    {
      id: "b4-sub3",
      title: "ForeignMission",
      subType: "tRPC API",
      description: "Executes trade, visas, or espionage targets.",
      offset: { x: 230, y: 150 },
    },
  ],
  b5: [
    {
      id: "b5-sub1",
      title: "CountryEventSpine",
      subType: "Prisma Model",
      description: "Audit trail log mapping results to timeline.",
      offset: { x: 230, y: -40 },
    },
    {
      id: "b5-sub2",
      title: "getTimelineEvents",
      subType: "tRPC API",
      description: "Fetches historical records sorted by epoch.",
      offset: { x: 230, y: 60 },
    },
  ],
  b6: [
    {
      id: "b6-sub1",
      title: "NationalIssue",
      subType: "Prisma Model",
      description: "Emergent issues feeding back to situation briefs.",
      offset: { x: 230, y: -40 },
    },
    {
      id: "b6-sub2",
      title: "triggerCrisis",
      subType: "tRPC API",
      description: "Mutation bypassing standard cabinet prep.",
      offset: { x: 230, y: 60 },
    },
  ],
};

// Sub-nodes configuration maps for Gameplay Loops
const loopSubNodes: Record<
  string,
  Array<{
    id: string;
    title: string;
    subType: "Step" | "Verb" | "Mechanic";
    description: string;
    offset: { x: number; y: number };
  }>
> = {
  l1: [
    {
      id: "l1-sub1",
      title: "National Vision",
      subType: "Step",
      description: "Define identity constraints.",
      offset: { x: 230, y: -90 },
    },
    {
      id: "l1-sub2",
      title: "Resource Commit",
      subType: "Step",
      description: "Reserve budget and CivCap.",
      offset: { x: 230, y: 10 },
    },
    {
      id: "l1-sub3",
      title: "Emergency Spawns",
      subType: "Mechanic",
      description: "Generate friction issues.",
      offset: { x: 230, y: 110 },
    },
  ],
  l2: [
    {
      id: "l2-sub1",
      title: "manifestoCheck",
      subType: "Mechanic",
      description: "Bargain on manifestos.",
      offset: { x: 230, y: -90 },
    },
    {
      id: "l2-sub2",
      title: "Coalition Math",
      subType: "Step",
      description: "Count seat voting weights.",
      offset: { x: 230, y: 10 },
    },
    {
      id: "l2-sub3",
      title: "redistributeSeats",
      subType: "Mechanic",
      description: "Voter response algorithm.",
      offset: { x: 230, y: 110 },
    },
  ],
  l3: [
    {
      id: "l3-sub1",
      title: "Cabinet Debate",
      subType: "Verb",
      description: "Debate choices with brokers.",
      offset: { x: 230, y: -70 },
    },
    {
      id: "l3-sub2",
      title: "Plan Selection",
      subType: "Step",
      description: "Choose Plan A, B, C, or D.",
      offset: { x: 230, y: 30 },
    },
    {
      id: "l3-sub3",
      title: "Minutes Log",
      subType: "Step",
      description: "Record results to history.",
      offset: { x: 230, y: 130 },
    },
  ],
  l4: [
    {
      id: "l4-sub1",
      title: "Cost Calculation",
      subType: "Mechanic",
      description: "Determine CivCap costs.",
      offset: { x: 230, y: -50 },
    },
    {
      id: "l4-sub2",
      title: "Qualitative Mask",
      subType: "Mechanic",
      description: "Hide numbers on low efficiency.",
      offset: { x: 230, y: 50 },
    },
  ],
  l5: [
    {
      id: "l5-sub1",
      title: "Spatial Query",
      subType: "Mechanic",
      description: "Poll map cells for demand.",
      offset: { x: 230, y: -50 },
    },
    {
      id: "l5-sub2",
      title: "Broker Protest",
      subType: "Step",
      description: "Factions strike over land use.",
      offset: { x: 230, y: 50 },
    },
  ],
  l6: [
    {
      id: "l6-sub1",
      title: "Summit Engine",
      subType: "Mechanic",
      description: "Convene diplomatic meetings.",
      offset: { x: 230, y: -50 },
    },
    {
      id: "l6-sub2",
      title: "treatyDecay",
      subType: "Mechanic",
      description: "Apply alignment decay ticks.",
      offset: { x: 230, y: 50 },
    },
  ],
  l7: [
    {
      id: "l7-sub1",
      title: "Triage Cabinet",
      subType: "Verb",
      description: "Zero preparation convening.",
      offset: { x: 230, y: -40 },
    },
    {
      id: "l7-sub2",
      title: "Inquiry Commit",
      subType: "Step",
      description: "Establish public inquiries.",
      offset: { x: 230, y: 60 },
    },
  ],
  l8: [
    {
      id: "l8-sub1",
      title: "Objective Unlock",
      subType: "Step",
      description: "Expose hidden DAG nodes.",
      offset: { x: 230, y: -40 },
    },
    {
      id: "l8-sub2",
      title: "Windfall Tick",
      subType: "Mechanic",
      description: "Calculate demographic bonuses.",
      offset: { x: 230, y: 60 },
    },
  ],
  l9: [
    {
      id: "l9-sub1",
      title: "Ledger Commit",
      subType: "Verb",
      description: "Write timeline history.",
      offset: { x: 230, y: -40 },
    },
    {
      id: "l9-sub2",
      title: "WikiOS Push",
      subType: "Mechanic",
      description: "Update local markdown files.",
      offset: { x: 230, y: 60 },
    },
  ],
};

export default function DesignBiblePage() {
  const [activeTab, setActiveTab] = useState("philosophy");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLoopId, setSelectedLoopId] = useState<string | null>("l1");
  const [expandedBackendNodeId, setExpandedBackendNodeId] = useState<string | null>(null);

  // Focus and scroll state captures for React Flow visualizers
  const [isBackendFocused, setIsBackendFocused] = useState(false);
  const [isLoopsFocused, setIsLoopsFocused] = useState(false);
  const [isBackendMaximized, setIsBackendMaximized] = useState(false);
  const [isLoopsMaximized, setIsLoopsMaximized] = useState(false);

  const backendRef = useRef<HTMLDivElement>(null);
  const loopsRef = useRef<HTMLDivElement>(null);

  // Click outside listener to release scrolling zoom focus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (backendRef.current && !backendRef.current.contains(event.target as any)) {
        setIsBackendFocused(false);
      }
      if (loopsRef.current && !loopsRef.current.contains(event.target as any)) {
        setIsLoopsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Keyboard shortcut listener to close fullscreen visualizers with Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsBackendMaximized(false);
        setIsLoopsMaximized(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Block body document scrolling when fullscreen visualizers are active
  useEffect(() => {
    if (isBackendMaximized || isLoopsMaximized) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isBackendMaximized, isLoopsMaximized]);

  // Facet Playground State
  const [playgroundVariant, setPlaygroundVariant] = useState<any>("base");
  const [playgroundDepth, setPlaygroundDepth] = useState<1 | 2 | 3 | 4>(2);
  const [playgroundInteractivity, setPlaygroundInteractivity] = useState<any>("hover");
  const [playgroundRefraction, setPlaygroundRefraction] = useState(true);

  // React Flow node selection handler
  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("l") && !node.id.includes("sub")) {
      setSelectedLoopId((prev) => (prev === node.id ? null : node.id));
    }
  };

  // Backend connections node click expansion handler
  const onBackendNodeClick = (_event: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("b") && !node.id.includes("sub")) {
      setExpandedBackendNodeId((prev) => (prev === node.id ? null : node.id));
    }
  };

  // Dynamic nodes generation for the Backend Connections graph
  const backendNodes = useMemo(() => {
    const baseNodesConfig = [
      {
        id: "b1",
        title: "User Ambition",
        description: "Player declares a National Vision or Strategic Objective.",
        borderColor: "border-indigo-500/30",
        icon: <User className="h-3.5 w-3.5 text-indigo-400" />,
        basePos: { x: 20, y: 140 },
      },
      {
        id: "b2",
        title: "Intent Engine (OS)",
        description: "DAG graph maps prerequisite & blocker nodes in Postgres.",
        borderColor: "border-blue-500/30",
        icon: <GitBranch className="h-3.5 w-3.5 text-blue-400" />,
        basePos: { x: 220, y: 140 },
      },
      {
        id: "b3",
        title: "Meeting System",
        description: "Cabinet councils draft Options & negotiate with Brokers.",
        borderColor: "border-purple-500/30",
        icon: <Calendar className="h-3.5 w-3.5 text-purple-400" />,
        basePos: { x: 440, y: 40 },
      },
      {
        id: "b4",
        title: "Executive Domains",
        description: "Embassies & coalition portfolios run localized programs.",
        borderColor: "border-cyan-500/30",
        icon: <Compass className="h-3.5 w-3.5 text-cyan-400" />,
        basePos: { x: 440, y: 240 },
      },
      {
        id: "b5",
        title: "Timeline Ledger",
        description: "Audit spine and ThinkPages commit actions permanently.",
        borderColor: "border-green-500/30",
        icon: <History className="h-3.5 w-3.5 text-green-400" />,
        basePos: { x: 660, y: 140 },
      },
      {
        id: "b6",
        title: "Crisis & Issues Loop",
        description: "Emergent issues push back and target active intents.",
        borderColor: "border-red-500/30",
        icon: <AlertOctagon className="h-3.5 w-3.5 text-red-400" />,
        basePos: { x: 330, y: 340 },
      },
    ];

    // Compute shifted positions to make space for sub-nodes
    const shiftedNodes: Node[] = baseNodesConfig.map((node) => {
      let x = node.basePos.x;
      let y = node.basePos.y;

      if (expandedBackendNodeId) {
        const shiftAmount = 250;

        if (expandedBackendNodeId === "b1") {
          if (node.id !== "b1") x += shiftAmount;
        } else if (expandedBackendNodeId === "b2") {
          if (node.id === "b3" || node.id === "b4" || node.id === "b5") x += shiftAmount;
          if (node.id === "b6") {
            x += shiftAmount / 2;
            y += 40;
          }
        } else if (expandedBackendNodeId === "b3") {
          if (node.id === "b5") x += shiftAmount;
        } else if (expandedBackendNodeId === "b4") {
          if (node.id === "b5") x += shiftAmount;
        } else if (expandedBackendNodeId === "b5") {
          // b5 is rightmost, no shifting needed for others
        } else if (expandedBackendNodeId === "b6") {
          if (node.id === "b6") y += 80;
        }
      }

      const isExpanded = node.id === expandedBackendNodeId;

      return {
        id: node.id,
        type: "system",
        position: { x, y },
        data: {
          title: node.title,
          description: node.description,
          borderColor: isExpanded
            ? `${node.borderColor} ring-2 ring-indigo-505/50 shadow-indigo-550/20`
            : node.borderColor,
          icon: node.icon,
        },
      };
    });

    // Spawn sub-nodes if a parent is expanded
    if (expandedBackendNodeId && backendSubNodes[expandedBackendNodeId]) {
      const parentNode = shiftedNodes.find((n) => n.id === expandedBackendNodeId);
      if (parentNode) {
        const subData = backendSubNodes[expandedBackendNodeId];
        const subNodesList: Node[] = subData.map((sub) => ({
          id: sub.id,
          type: "sub",
          position: {
            x: parentNode.position.x + sub.offset.x,
            y: parentNode.position.y + sub.offset.y,
          },
          data: {
            title: sub.title,
            subType: sub.subType,
            description: sub.description,
            borderColor: parentNode.data.borderColor,
          },
        }));
        return [...shiftedNodes, ...subNodesList];
      }
    }

    return shiftedNodes;
  }, [expandedBackendNodeId]);

  // Dynamic edges generation for the Backend Connections graph
  const backendEdges = useMemo(() => {
    const baseEdges: Edge[] = [
      { id: "eb1-2", source: "b1", target: "b2", animated: true, style: { stroke: "#6366f1" } },
      { id: "eb2-3", source: "b2", target: "b3", style: { stroke: "#3b82f6" } },
      { id: "eb2-4", source: "b2", target: "b4", style: { stroke: "#3b82f6" } },
      { id: "eb3-5", source: "b3", target: "b5", style: { stroke: "#8b5cf6" } },
      { id: "eb4-5", source: "b4", target: "b5", style: { stroke: "#06b6d4" } },
      { id: "eb5-6", source: "b5", target: "b6", style: { stroke: "#10b981" } },
      { id: "eb6-1", source: "b6", target: "b1", animated: true, style: { stroke: "#ef4444" } },
    ];

    if (!expandedBackendNodeId || !backendSubNodes[expandedBackendNodeId]) return baseEdges;

    const subData = backendSubNodes[expandedBackendNodeId];
    const subEdges: Edge[] = subData.map((sub) => ({
      id: `edge-${expandedBackendNodeId}-${sub.id}`,
      source: expandedBackendNodeId,
      target: sub.id,
      animated: true,
      style: { stroke: "#818cf8", strokeDasharray: "4 4" },
    }));

    return [...baseEdges, ...subEdges];
  }, [expandedBackendNodeId]);

  // Dynamic nodes generation for the Gameplay Loops graph
  const loopNodes = useMemo(() => {
    const baseLoopsConfig = [
      {
        id: "l1",
        title: "Macro Loop",
        description: "Vision -> commitments -> emergence -> memory.",
        borderColor: "border-indigo-500/30",
        icon: <Layers className="h-3.5 w-3.5 text-indigo-400" />,
        basePos: { x: 20, y: 140 },
      },
      {
        id: "l2",
        title: "Legislature Loop",
        description: "Elections redistribution based on platform records.",
        borderColor: "border-pink-500/30",
        icon: <FileText className="h-3.5 w-3.5 text-pink-400" />,
        basePos: { x: 220, y: 40 },
      },
      {
        id: "l3",
        title: "Meeting Loop",
        description: "Cabinet deliberation resolving agenda options.",
        borderColor: "border-purple-500/30",
        icon: <Calendar className="h-3.5 w-3.5 text-purple-400" />,
        basePos: { x: 220, y: 140 },
      },
      {
        id: "l4",
        title: "Policy Loop",
        description: "Departmental execution drafts and capacity costs.",
        borderColor: "border-blue-500/30",
        icon: <GitBranch className="h-3.5 w-3.5 text-blue-400" />,
        basePos: { x: 440, y: 140 },
      },
      {
        id: "l5",
        title: "Regional Loop",
        description: "Spatial need fulfillment and local development records.",
        borderColor: "border-green-500/30",
        icon: <Compass className="h-3.5 w-3.5 text-green-400" />,
        basePos: { x: 660, y: 140 },
      },
      {
        id: "l6",
        title: "Foreign Affairs",
        description: "Diplomatic summits, embassies, and dynamic treaty pacts.",
        borderColor: "border-cyan-500/30",
        icon: <Globe className="h-3.5 w-3.5 text-cyan-400" />,
        basePos: { x: 440, y: 40 },
      },
      {
        id: "l7",
        title: "Crisis Loop",
        description: "Sudden alerts requiring urgent zero-prep deliberation.",
        borderColor: "border-red-500/30",
        icon: <AlertOctagon className="h-3.5 w-3.5 text-red-400" />,
        basePos: { x: 220, y: 240 },
      },
      {
        id: "l8",
        title: "Opportunity Loop",
        description: "Open windows for ambitious strategic adjustments.",
        borderColor: "border-amber-500/30",
        icon: <Sparkles className="h-3.5 w-3.5 text-amber-400" />,
        basePos: { x: 440, y: 240 },
      },
      {
        id: "l9",
        title: "Legacy Loop",
        description: "Historical summaries writing the timeline memory.",
        borderColor: "border-emerald-500/30",
        icon: <History className="h-3.5 w-3.5 text-emerald-400" />,
        basePos: { x: 20, y: 240 },
      },
    ];

    // Compute shifted positions to make space for sub-nodes
    const shiftedNodes: Node[] = baseLoopsConfig.map((node) => {
      let x = node.basePos.x;
      const y = node.basePos.y;

      if (selectedLoopId) {
        const shiftAmount = 250;

        if (selectedLoopId === "l1") {
          if (node.id !== "l1" && node.id !== "l9") x += shiftAmount;
        } else if (selectedLoopId === "l2" || selectedLoopId === "l3" || selectedLoopId === "l7") {
          if (node.id === "l4" || node.id === "l5" || node.id === "l6" || node.id === "l8")
            x += shiftAmount;
        } else if (selectedLoopId === "l4" || selectedLoopId === "l6" || selectedLoopId === "l8") {
          if (node.id === "l5") x += shiftAmount;
        } else if (selectedLoopId === "l9") {
          if (node.id !== "l9" && node.id !== "l1") x += shiftAmount;
        }
      }

      const isExpanded = node.id === selectedLoopId;

      return {
        id: node.id,
        type: "system",
        position: { x, y },
        data: {
          title: node.title,
          description: node.description,
          borderColor: isExpanded
            ? `${node.borderColor} ring-2 ring-indigo-505/50 shadow-indigo-550/20`
            : node.borderColor,
          icon: node.icon,
        },
      };
    });

    // Spawn sub-nodes if a parent is selected/expanded
    if (selectedLoopId && loopSubNodes[selectedLoopId]) {
      const parentNode = shiftedNodes.find((n) => n.id === selectedLoopId);
      if (parentNode) {
        const subData = loopSubNodes[selectedLoopId];
        const subNodesList: Node[] = subData.map((sub) => ({
          id: sub.id,
          type: "sub",
          position: {
            x: parentNode.position.x + sub.offset.x,
            y: parentNode.position.y + sub.offset.y,
          },
          data: {
            title: sub.title,
            subType: sub.subType,
            description: sub.description,
            borderColor: parentNode.data.borderColor,
          },
        }));
        return [...shiftedNodes, ...subNodesList];
      }
    }

    return shiftedNodes;
  }, [selectedLoopId]);

  // Dynamic edges generation for the Gameplay Loops graph
  const loopEdges = useMemo(() => {
    const baseEdges: Edge[] = [
      { id: "el1-3", source: "l1", target: "l3", animated: true, style: { stroke: "#6366f1" } },
      { id: "el3-4", source: "l3", target: "l4", style: { stroke: "#8b5cf6" } },
      { id: "el3-6", source: "l3", target: "l6", style: { stroke: "#8b5cf6" } },
      { id: "el4-5", source: "l4", target: "l5", style: { stroke: "#3b82f6" } },
      { id: "el5-1", source: "l5", target: "l1", animated: true, style: { stroke: "#10b981" } },
      { id: "el7-3", source: "l7", target: "l3", style: { stroke: "#ef4444" } },
      { id: "el8-3", source: "l8", target: "l3", style: { stroke: "#f59e0b" } },
      { id: "el1-9", source: "l1", target: "l9", style: { stroke: "#10b981" } },
      { id: "el9-2", source: "l9", target: "l2", style: { stroke: "#10b981" } },
      { id: "el2-1", source: "l2", target: "l1", animated: true, style: { stroke: "#ec4899" } },
    ];

    if (!selectedLoopId || !loopSubNodes[selectedLoopId]) return baseEdges;

    const subData = loopSubNodes[selectedLoopId];
    const subEdges: Edge[] = subData.map((sub) => ({
      id: `edge-${selectedLoopId}-${sub.id}`,
      source: selectedLoopId,
      target: sub.id,
      animated: true,
      style: { stroke: "#a5b4fc", strokeDasharray: "4 4" },
    }));

    return [...baseEdges, ...subEdges];
  }, [selectedLoopId]);

  // Selected Loop Breakdown metadata
  const currentLoopDetail = selectedLoopId ? loopBreakdowns[selectedLoopId] : null;

  return (
    <div className="bg-background text-foreground min-h-screen font-sans antialiased selection:bg-indigo-500/30">
      {/* Background Refraction Glows */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-indigo-500/5 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[50vw] w-[50vw] rounded-full bg-cyan-500/5 blur-[120px]" />

      {/* Volumetric Header — docks cleanly below global navbar */}
      <header className="border-border bg-background/80 sticky top-16 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 shadow-lg shadow-indigo-500/5">
              <Cpu className="text-indigo-550 h-5 w-5" />
            </div>
            <div>
              <h1 className="text-md from-foreground via-foreground/90 to-foreground/75 bg-gradient-to-r bg-clip-text font-bold tracking-tight text-transparent">
                IxStates MyCountry v4
              </h1>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
                Internal Product Doctrine & Design Bible
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
              <input
                type="text"
                placeholder="Search specs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-muted/30 border-border placeholder:text-muted-foreground/60 w-64 rounded-md border py-1.5 pr-4 pl-9 text-xs transition-colors focus:border-indigo-500/50 focus:outline-none"
              />
            </div>
            <Badge
              variant="outline"
              className="text-indigo-550 border-indigo-500/30 bg-indigo-500/5 px-2 py-0.5 font-mono text-[10px]"
            >
              v4.0.0 "Ogma"
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-4">
        {/* Sticky Navigation Sidebar */}
        <aside className="h-fit space-y-6 lg:sticky lg:top-24 lg:col-span-1">
          <FacetCard depth={2} className="space-y-2 p-4">
            <h3 className="text-muted-foreground mb-3 px-3 text-xs font-semibold tracking-wider uppercase">
              Sections
            </h3>
            <nav className="space-y-1">
              {[
                { id: "philosophy", label: "Product Philosophy", icon: BookOpen },
                { id: "grammar", label: "Gameplay Grammar", icon: FileText },
                { id: "intent", label: "Intent Engine", icon: GitBranch },
                { id: "meetings", label: "Meeting System", icon: Calendar },
                { id: "dashboard", label: "Executive Dashboard", icon: Layers },
                { id: "domains", label: "Executive Domains", icon: Compass },
                { id: "concord", label: "Concord Engine", icon: Cpu },
                { id: "loops-ux", label: "Loops & UX Rules", icon: Sliders },
                { id: "branding", label: "Brand Architecture", icon: Sparkles },
                { id: "playground", label: "Facet Design System", icon: FileCode },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                      activeTab === tab.id
                        ? "border-l-2 border-indigo-500 bg-indigo-500/10 pl-4 text-indigo-500"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </FacetCard>
        </aside>

        {/* Dynamic Spec Container */}
        <main className="space-y-8 lg:col-span-3">
          {activeTab === "philosophy" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Product Philosophy: Expressing Vision
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  MyCountry is not primarily about simulating a country from above. It is about
                  simulating the experience of a government attempting to steer a country that has
                  its own institutions, factions, constraints, neighbors, memory, and inertia.
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                  <div className="text-xs leading-relaxed text-indigo-900 dark:text-indigo-200">
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      The Core Mission:
                    </span>
                    Help the player express a vision for their country, translate that vision into
                    government action, let institutions and the world push back naturally, then
                    preserve the consequences as national history.
                  </div>
                </div>
              </FacetCard>

              {/* React Flow Integration showing backend links */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  Backend Architecture Connections
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  Click a parent system node in the graph below to dynamically expand and inspect
                  its database models, schemas, and tRPC endpoints:
                </p>
                <div
                  ref={backendRef}
                  onClick={() => setIsBackendFocused(true)}
                  className={`bg-muted/20 relative h-[400px] overflow-hidden rounded-lg border transition-all duration-300 ${
                    isBackendFocused
                      ? "ring-indigo-505/50 border-indigo-505/50 shadow-lg ring-2 shadow-indigo-500/5"
                      : "border-border"
                  }`}
                >
                  {isBackendFocused && (
                    <div className="animate-in fade-in zoom-in absolute top-2 right-12 z-10 flex items-center gap-1.5 rounded bg-indigo-500/90 px-2 py-1 font-mono text-[9px] tracking-tight text-white shadow-md duration-200">
                      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                      Active: Scroll to Zoom | Click Out to Release
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBackendMaximized(true);
                    }}
                    title="Maximize Visualizer"
                    className="bg-background/80 hover:bg-background border-border text-muted-foreground hover:text-foreground absolute top-2 right-2 z-10 cursor-pointer rounded-md border p-1.5 shadow-md transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="h-full min-h-[300px] w-full flex-1">
                    <ReactFlow
                      nodes={backendNodes}
                      edges={backendEdges}
                      nodeTypes={nodeTypes}
                      fitView
                      onNodeClick={onBackendNodeClick}
                      preventScrolling={isBackendFocused}
                      zoomOnScroll={isBackendFocused}
                      nodesConnectable={false}
                      nodesDraggable={false}
                    >
                      <Background color="#ccc" gap={16} size={1} />
                      <Controls className="!bg-background !border-border !fill-foreground [&>button]:!border-border hover:[&>button]:!bg-muted" />
                    </ReactFlow>
                  </div>
                </div>
              </FacetCard>

              {/* What it is / is not */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FacetCard depth={2} className="space-y-3 p-5">
                  <span className="text-green-505 text-[10px] font-bold tracking-wider uppercase">
                    What it is
                  </span>
                  <h3 className="text-foreground text-sm font-semibold dark:text-white">
                    Executive government as player character
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    The player is not the population, the market, the military, or a timeless
                    national spirit. They are the active administration: setting priorities,
                    convening meetings, authorizing policy, negotiating with power brokers, and
                    adapting to incomplete information.
                  </p>
                </FacetCard>
                <FacetCard depth={2} className="space-y-3 p-5">
                  <span className="text-red-555 text-[10px] font-bold tracking-wider uppercase">
                    What it is not
                  </span>
                  <h3 className="text-foreground text-sm font-semibold dark:text-white">
                    Random issue management
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Issues, crises, opportunities, and reports should rarely feel like isolated
                    prompts. They should emerge because the player has chosen commitments, neglected
                    constraints, or entered relationships that generate pressure.
                  </p>
                </FacetCard>
              </div>

              {/* Design Boundary */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  Design Boundary
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  The game should not ask, "Which stat do you want to increase?" It should ask,
                  "What is your government trying to accomplish?" Statistics are instruments and
                  evidence. They are not the fantasy.
                </p>
              </FacetCard>

              {/* Design Pillars */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  Design Pillars
                </h3>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      1. Intent Over Reaction
                    </span>
                    The player should spend most of their time initiating direction, not clearing a
                    queue. Reactive events matter because they challenge declared intent.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      2. Government Is the Interface
                    </span>
                    Policies, meetings, departments, power brokers, CivCap, budgets, and diplomacy
                    are all ways the executive tries to convert intention into reality.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      3. Deliberation Before Commitment
                    </span>
                    The game should rarely jump from desire directly to policy. Ministers, agencies,
                    advisors, factions, and data should turn a fuzzy desire into concrete options.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      4. Capacity Makes Choices Real
                    </span>
                    CivCap, political capital, money, time, legitimacy, attention, and expertise are
                    forms of commitment. Every serious choice spends at least one.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      5. Pushback Creates Story
                    </span>
                    A good system does not block the player arbitrarily. It creates believable
                    resistance from institutions, stakeholders, markets, allies, rivals, geography,
                    and prior promises.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      6. History Is the Reward
                    </span>
                    The long-term payoff is not only better numbers. It is a country with a
                    recognizable identity and a permanent record of how it became that way.
                  </div>
                </div>
              </FacetCard>
            </div>
          )}

          {activeTab === "grammar" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Gameplay Grammar
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Every interaction should be built from government verbs. This keeps the player
                  inside the fantasy of governing rather than operating a spreadsheet with flags. No
                  subsystem should require a player to understand its internal model before they can
                  express what they want.
                </p>
              </FacetCard>

              <FacetCard depth={2} className="p-5">
                <h3 className="text-foreground mb-3 text-sm font-semibold dark:text-white">
                  The Governing Verbs
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b">
                        <th className="w-1/4 py-2.5 font-semibold">Verb</th>
                        <th className="w-2/5 py-2.5 font-semibold">Player Meaning</th>
                        <th className="py-2.5 font-semibold">System Meaning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border text-foreground divide-y dark:text-slate-300">
                      {[
                        {
                          verb: "Declare",
                          player: "Name the direction or problem.",
                          system:
                            "Create intent, agenda item, milestone, crisis objective, or diplomatic aim.",
                        },
                        {
                          verb: "Convene",
                          player: "Bring government actors into a room.",
                          system: "Assemble ministries, advisors, brokers, data, and constraints.",
                        },
                        {
                          verb: "Negotiate",
                          player: "Shape a viable path through resistance.",
                          system:
                            "Expose trade-offs, concessions, blockers, and alternative plans.",
                        },
                        {
                          verb: "Authorize",
                          player: "Commit the government.",
                          system:
                            "Spend resources and instantiate policies, projects, treaties, orders, or operations.",
                        },
                        {
                          verb: "Review",
                          player: "Learn what happened.",
                          system:
                            "Surface execution quality, reactions, consequences, and recommended adaptations.",
                        },
                        {
                          verb: "Remember",
                          player: "Fold the result into national identity.",
                          system:
                            "Write timeline entries, institutional memory, reputation changes, and future hooks.",
                        },
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="text-indigo-550 py-3 font-semibold">{row.verb}</td>
                          <td className="text-muted-foreground py-3">{row.player}</td>
                          <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {row.system}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FacetCard>
            </div>
          )}

          {activeTab === "intent" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Intent Engine — "Facilitating Player Intent"
                </h2>
                <div className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                  1. Executive Summary
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The Intent Engine is the primary interaction model for MyCountry. Instead of
                  asking players to manipulate raw mechanics directly (policies, budgets, GDP
                  modifiers, ministries), the Intent Engine asks a single question: **"What is your
                  government trying to accomplish?"** The engine translates player goals into
                  executable governmental actions. The player expresses vision, the government
                  develops options, the world provides resistance, and the player adapts. No
                  subsystem is allowed to bypass this pipeline.
                </p>
              </FacetCard>

              {/* Three Levels */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  2. The Three Levels of Intent
                </div>
                <p className="text-muted-foreground text-xs">
                  Every intent belongs to one of three layers, organized as a directed graph rather
                  than a flat queue:
                </p>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      National Vision (10-100 Years)
                    </span>
                    Overarching national identity. E.g., <em>Become a naval superpower</em>,{" "}
                    <em>Build the world's strongest welfare state</em>,{" "}
                    <em>Become energy independent</em>.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Strategic Objectives (1-10 Years)
                    </span>
                    Measurable goals supporting or independent of the Vision. E.g.,{" "}
                    <em>Reduce inflation</em>, <em>Modernize the navy</em>,{" "}
                    <em>Increase birth rate</em>, <em>Improve public transit</em>.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Operational Tasks (Days-Months)
                    </span>
                    Immediate administrative actions. E.g., <em>Hold budget meeting</em>,{" "}
                    <em>Draft education reform</em>, <em>Sign trade agreement</em>,{" "}
                    <em>Deploy emergency services</em>.
                  </div>
                </div>
              </FacetCard>

              {/* Intent Lifecycle */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  3. The Intent Lifecycle
                </div>
                <p className="text-muted-foreground text-xs">
                  All governmental actions follow a unified lifecycle.
                </p>
                <div className="bg-muted/50 border-border text-foreground space-y-1.5 overflow-x-auto rounded-lg border p-4 font-mono text-xs dark:text-slate-300">
                  <div>Vision</div>
                  <div> ↓</div>
                  <div>
                    Intent Created (Goal Statement, Wizard, Opportunity, or Vision continuation)
                  </div>
                  <div> ↓</div>
                  <div>
                    Analysis (Ministries assess budget, CivCap, Power Broker support, and Fog of
                    Information)
                  </div>
                  <div> ↓</div>
                  <div>
                    Government Deliberation (Dynamic generation of Plans A, B, and C with pros/cons)
                  </div>
                  <div> ↓</div>
                  <div>
                    Commitment (Selected plan reserves CivCap, schedules Meetings, drafts Policies)
                  </div>
                  <div> ↓</div>
                  <div>
                    Execution & Bureaucratic Action (Departments implement; low efficiency creates
                    Fog)
                  </div>
                  <div> ↓</div>
                  <div>
                    Reaction & Resistance (Contextual issues spawn directly in response to active
                    intents)
                  </div>
                  <div> ↓</div>
                  <div>
                    Adaptation (Player resolves complications through secondary choices, e.g. budget
                    injection)
                  </div>
                  <div> ↓</div>
                  <div>Completion / Failure (Outcome summary finalized; CivCap released)</div>
                  <div> ↓</div>
                  <div>
                    Historical Legacy (Timeline and ThinkPages permanently record the result)
                  </div>
                </div>
              </FacetCard>

              {/* Directed Graph */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  4. Intent as a Directed Graph
                </div>
                <p className="text-muted-foreground text-xs">
                  To support complex, interdependent goals, intents are modeled as a Directed
                  Acyclic Graph (DAG). Completing prerequisite nodes automatically transitions
                  dependent child nodes from Blocked to Proposed status.
                </p>
                <div className="bg-muted/50 border-border text-foreground space-y-2 overflow-x-auto rounded-lg border p-4 font-mono text-xs dark:text-slate-300">
                  <div>National Vision: "Become a Global Maritime Power"</div>
                  <div className="border-border ml-3 border-l py-1 pl-6">
                    <div>
                      ├── Strategic Objective: "Modernize the Navy" (Requires: Expand Shipbuilding
                      Industry)
                    </div>
                    <div className="border-border ml-3 border-l py-1 pl-6">
                      <div>
                        ├── Operational Task: "Expand Shipbuilding Industry"{" "}
                        <span className="text-green-505 font-bold">[Completed]</span>
                      </div>
                      <div>
                        ├── Operational Task: "Recruit Naval Personnel"{" "}
                        <span className="text-indigo-550 font-bold">[Active]</span>
                      </div>
                      <div>
                        └── Operational Task: "Adopt Blue Water Doctrine"{" "}
                        <span className="text-amber-505 font-bold">
                          [Blocked - Prerequisite missing]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </FacetCard>

              {/* Schema Spec */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  5. Database Schema Spec (Prisma)
                </div>
                <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-md border p-3 font-mono text-[10px] dark:text-slate-300">
                  {`model NationalIntent {
  id             String             @id @default(cuid())
  countryId      String
  title          String
  description    String?
  layer          String             // "VISION" | "STRATEGIC" | "OPERATIONAL"
  status         String             // "blocked" | "proposed" | "active" | "completed" | "failed"
  civCapCost     Float              @default(0)
  budgetCost     Float              @default(0)
  category       String
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  parentIntents  IntentDependency[] @relation("DependentIntents")
  childIntents   IntentDependency[] @relation("PrerequisiteIntents")
}

model IntentDependency {
  id             String             @id @default(cuid())
  parentIntentId String
  childIntentId  String
  dependencyType String             @default("prerequisite") // "prerequisite" | "blocker"
  
  parentIntent   NationalIntent     @relation("DependentIntents", fields: [parentIntentId], references: [id], onDelete: Cascade)
  childIntent    NationalIntent     @relation("PrerequisiteIntents", fields: [childIntentId], references: [id], onDelete: Cascade)
}`}
                </pre>
              </FacetCard>

              {/* Design Rules */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  6. Design Rules
                </div>
                <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-xs">
                  <li>
                    <strong>Rule 1: Players declare outcomes, never mechanics.</strong>
                  </li>
                  <li>
                    <strong>Rule 2: The government develops plans, not the UI.</strong>
                  </li>
                  <li>
                    <strong>Rule 3: Every commitment creates resistance.</strong> (No free
                    decisions).
                  </li>
                  <li>
                    <strong>Rule 4: Every resistance creates adaptation.</strong> (Failure is
                    gameplay).
                  </li>
                  <li>
                    <strong>Rule 5: Everything becomes history.</strong> (Timeline ledger tracking).
                  </li>
                  <li>
                    <strong>Rule 6: No subsystem bypasses the Intent Engine.</strong> (All modules
                    route here).
                  </li>
                </ul>
              </FacetCard>
            </div>
          )}

          {activeTab === "meetings" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Meeting System — "Government Happens Here"
                </h2>
                <div className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                  1. Executive Summary
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The Meeting System is the primary gameplay interface of MyCountry. Players do not
                  directly enact most governmental actions. Instead, they convene meetings where the
                  government develops recommendations, negotiates priorities, and commits to action.
                  If the Intent Engine is the brain of the nation, the Meeting System is the heart
                  where deliberation occurs. Every major national decision begins in a meeting.
                </p>
              </FacetCard>

              {/* Pillars */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  2. Core Design Pillars
                </div>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Meetings are Gameplay
                    </span>
                    Not calendar items or cutscenes, but the primary surface where players negotiate
                    with institutions and brokers.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Produce Commitments
                    </span>
                    Meetings do not immediately change stats; they create policies, programs,
                    budgets, and military directives that execute later.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Coordinate Government
                    </span>
                    Represents the dynamic intersection of ministries (Treasury, Defense, Health),
                    Power Brokers, and political parties.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Generate Knowledge
                    </span>
                    Exposes briefings, warnings, risk assessments, and dynamic recommendation
                    options rather than raw spreadsheets.
                  </div>
                </div>
              </FacetCard>

              {/* Loop */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  3. The Core Gameplay Loop
                </div>
                <div className="bg-muted/50 border-border text-foreground space-y-1.5 overflow-x-auto rounded-lg border p-4 font-mono text-xs dark:text-slate-300">
                  <div>Government Need (Intent/Issue/Opportunity/Promise)</div>
                  <div> ↓</div>
                  <div>Meeting Convened</div>
                  <div> ↓</div>
                  <div>Preparation (Departments compile intelligence; CivCap spent)</div>
                  <div> ↓</div>
                  <div>
                    Government Briefing (Executive summary, cost estimates, confidence rating)
                  </div>
                  <div> ↓</div>
                  <div>Deliberation (Ministries debate; Power Brokers lobby; conflict emerges)</div>
                  <div> ↓</div>
                  <div>
                    Decision (Player selects Plan A, B, C, delays, or requests further study)
                  </div>
                  <div> ↓</div>
                  <div>Commitment (Selected plan is generated as a node in the Intent Engine)</div>
                  <div> ↓</div>
                  <div>Execution & Consequences</div>
                  <div> ↓</div>
                  <div>Historical Record (Permanent timeline ledger entry)</div>
                </div>
              </FacetCard>

              {/* Categories */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  4. Meeting Categories & Plugins
                </div>
                <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-xs">
                  <li>
                    <strong>Executive Cabinet:</strong> Coordinates national priorities across all
                    ministries.
                  </li>
                  <li>
                    <strong>Budget Session:</strong> Treasury and Finance negotiate allocations,
                    deficits, and tax changes.
                  </li>
                  <li>
                    <strong>National Security Council:</strong> Defense and Intelligence authorize
                    operations, procurement, and doctrine reform.
                  </li>
                  <li>
                    <strong>Foreign Affairs Summit:</strong> Envoys negotiate treaties, trade pacts,
                    and joint exercises.
                  </li>
                  <li>
                    <strong>Infrastructure Council:</strong> Coordinates energy, transit, and
                    housing projects.
                  </li>
                  <li>
                    <strong>Economic Council:</strong> Plans trade strategy, labor policy, and
                    subsidies.
                  </li>
                  <li>
                    <strong>Crisis Meeting:</strong> Immediate, time-sensitive triage session with
                    zero preparation and high information fog.
                  </li>
                </ul>
              </FacetCard>

              {/* Participant structure */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  5. Participant Profile Structure
                </div>
                <p className="text-muted-foreground text-xs">
                  Every meeting attendee has a defined profile affecting discussions and options:
                </p>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Role & Authority
                    </span>
                    Ministry portfolio or Power Broker group (e.g. Minister of Finance, Generals).
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Expertise & Influence
                    </span>
                    Technical competence rating and political weight (used for voting weight).
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Agenda & Approval
                    </span>
                    Personal political goals and alignment score with the active administration.
                  </div>
                </div>
              </FacetCard>

              {/* Recommendations */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  6. Dynamic Recommendation Engine
                </div>
                <p className="text-muted-foreground text-xs">
                  Rather than presenting single answers, the government generates dynamically
                  tailored plans based on the nation's state:
                </p>
                <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-xs">
                  <li>
                    <strong>Option A (State-Driven):</strong> High bureaucratic control, expensive,
                    fast, high CivCap cost.
                  </li>
                  <li>
                    <strong>Option B (Market-Driven):</strong> Cheap, private incentives, fast,
                    satisfies Magnates, lower public approval.
                  </li>
                  <li>
                    <strong>Option C (Balanced/Targeted):</strong> Moderate cost and timing,
                    balanced broker support.
                  </li>
                  <li>
                    <strong>Option D (Emergency Triage):</strong> Drastic cuts or high-risk
                    measures.
                  </li>
                </ul>
              </FacetCard>

              {/* Fog */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  7. Fog of Information & Governance Competence
                </div>
                <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-xs">
                  <li>
                    <strong>High Government Efficiency (&gt;75%):</strong> Briefings yield precise
                    cost estimates, clear risk forecasts, and reliable timelines.
                  </li>
                  <li>
                    <strong>Low Government Efficiency (&lt;45%):</strong> Data is missing, estimates
                    are masked as qualitative bands (e.g. "Highly Uncertain Cost"), advice is
                    contradictory, and surprise events occur mid-meeting.
                  </li>
                </ul>
              </FacetCard>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Executive Dashboard — "The Government Situation Room"
                </h2>
                <div className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                  1. Executive Summary
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The Executive Dashboard is the primary landing page for MyCountry. Rather than
                  acting as a static KPI tracking sheet, it functions as the **Government Situation
                  Room**, delivering structured, actionable briefings directly to the Head of
                  Government at the start of every session.
                </p>
              </FacetCard>

              {/* Dashboard Pillars */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  2. Core Design Pillars
                </div>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      The Government Never Sleeps
                    </span>
                    Summarizes offline developments and timeline shifts (e.g.{" "}
                    <em>"Since your last visit: Railway modernization entered Phase II"</em>).
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Every Card Demands a Decision
                    </span>
                    No card exists purely as flavor text. If it does not invite executive action, it
                    belongs in the deep Intelligence panel.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Executive, Not Analyst
                    </span>
                    Highlights choices and directions; analytics and raw numbers remain hidden under
                    Level 4 progressive disclosure tabs.
                  </div>
                </div>
              </FacetCard>

              {/* Grid Layout */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  3. Dashboard Grid Layout
                </div>
                <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-xs">
                  <li>
                    <strong>Executive Briefing (AI Morning Report):</strong> Recap of Yesterday's
                    Developments, Government Assessment, Today's Priorities, and Emerging Risks.
                  </li>
                  <li>
                    <strong>Urgent Matters (Max 5):</strong> Emergency sessions, expiring treaty
                    deadlines, or Power Broker ultimatums requiring immediate signatures.
                  </li>
                  <li>
                    <strong>Government Agenda:</strong> Live strategic progress meters pulled from
                    active NationalIntent graph nodes.
                  </li>
                  <li>
                    <strong>Active Commitments:</strong> Operational programs currently consuming
                    CivCap, budget, and department bandwidth.
                  </li>
                  <li>
                    <strong>Executive Calendar:</strong> Upcoming scheduled Cabinet meetings,
                    summits, and reviews.
                  </li>
                  <li>
                    <strong>Cabinet Recommendations:</strong> Actionable proposals submitted
                    directly from active departments.
                  </li>
                  <li>
                    <strong>Political & Diplomatic Climate:</strong> Status of Power Broker
                    relationships and outstanding external embassies.
                  </li>
                  <li>
                    <strong>Government Timeline:</strong> A persistent historical memory ledger of
                    recent completed events.
                  </li>
                </ol>
              </FacetCard>

              {/* Attention Model */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  4. Government Attention Model
                </div>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-4">
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Decide
                    </span>
                    Requires active executive approval or signing.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Review
                    </span>
                    Government requests oversight on an active program.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Monitor
                    </span>
                    Watch rising trends (e.g. inflation warnings).
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Celebrate
                    </span>
                    Celebrates administrative completions (e.g. infrastructure finished).
                  </div>
                </div>
              </FacetCard>

              {/* Priority weights */}
              <FacetCard depth={2} className="relative space-y-4 overflow-hidden p-5">
                <div className="text-indigo-550 font-mono text-xs font-bold uppercase">
                  5. State Engine & Priority Scoring
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  MATTERS are continuously prioritized on the dashboard. We will implement
                  `dashboard-state-engine.ts` to assign weights:
                </p>
                <div className="border-border bg-muted/50 text-foreground space-y-2 rounded-lg border p-4 font-mono text-[11px] dark:text-slate-300">
                  <div className="text-indigo-550 font-bold">
                    Priority Score = Category Weight + Urgency Weight + Intent Alignment Bonus
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 md:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground text-[9px] font-bold uppercase">
                        Decide Base
                      </div>
                      <div className="text-foreground font-bold dark:text-white">+100</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[9px] font-bold uppercase">
                        Emergency Flag
                      </div>
                      <div className="font-bold text-red-500">+200</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[9px] font-bold uppercase">
                        Vision Alignment
                      </div>
                      <div className="font-bold text-green-500">+75</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[9px] font-bold uppercase">
                        Time Limit (24h)
                      </div>
                      <div className="text-amber-505 font-bold">Up to +240</div>
                    </div>
                  </div>
                </div>
              </FacetCard>
            </div>
          )}

          {activeTab === "domains" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Government, Legislature, & Foreign Affairs Domains
                </h2>
                <div className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                  1. Executive Summary
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Under the MyCountry v4 philosophy, **Politics** and **Diplomacy** stop functioning
                  as standalone games or isolated menu pages. Instead, they are restructured as
                  **Executive Domains** plugging directly into the **Intent Engine** and **Meeting
                  System**.
                </p>
              </FacetCard>

              {/* Spec matrix */}
              <FacetCard depth={2} className="p-5">
                <div className="text-indigo-550 mb-3 font-mono text-xs font-bold uppercase">
                  2. Executive Matrix
                </div>
                <p className="text-muted-foreground mb-3 text-xs">
                  Every domain operates under the exact same grammar (Declare → Convene → Authorize
                  → Review), utilizing the same underlying engine:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b">
                        <th className="py-2.5 font-semibold">Domain</th>
                        <th className="py-2.5 font-semibold">Deliberation (Meeting)</th>
                        <th className="py-2.5 font-semibold">Commitment</th>
                        <th className="py-2.5 font-semibold">Execution Layer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border text-foreground divide-y dark:text-slate-300">
                      {[
                        {
                          domain: "Legislature",
                          meeting: "Legislative Strategy Meeting",
                          commitment: "Legislative Bill",
                          exec: "Coalition Ministries",
                        },
                        {
                          domain: "Foreign Affairs",
                          meeting: "Diplomatic Summit",
                          commitment: "Treaty / Active Pact",
                          exec: "Foreign Ministry / Embassies",
                        },
                        {
                          domain: "National Security",
                          meeting: "War Council",
                          commitment: "Operations",
                          exec: "Armed Forces",
                        },
                        {
                          domain: "Economy",
                          meeting: "Economic Council",
                          commitment: "Budget / Allocations",
                          exec: "Treasury / Central Bank",
                        },
                        {
                          domain: "Infrastructure",
                          meeting: "Planning Board",
                          commitment: "Projects",
                          exec: "Public Works",
                        },
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="text-foreground py-3 font-semibold dark:text-white">
                            {row.domain}
                          </td>
                          <td className="text-muted-foreground py-3">{row.meeting}</td>
                          <td className="text-indigo-550 py-3 font-mono">{row.commitment}</td>
                          <td className="text-muted-foreground py-3">{row.exec}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FacetCard>

              {/* Legislative Loop Detail */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-555 font-mono text-xs font-bold uppercase">
                  3. Legislature Domain (Elections & Politics Replaced)
                </div>
                <p className="text-muted-foreground text-xs">
                  The concept of a separate "Elections System" is removed. Instead, elections
                  represent the checkpoint transition in a continuous legislative loop.
                </p>
                <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-xs">
                  <li>
                    <strong>Political Parties as Active Negotiators:</strong> Political parties are
                    modeled as active entities. Each party has a seats count, manifesto ideologies,
                    red lines (dealbreakers), and political capital.
                  </li>
                  <li>
                    <strong>Legislative Bills as Commitments:</strong> Introducing a bill creates a
                    commitment node in the Intent graph.
                  </li>
                  <li>
                    <strong>Deliberate & Vote:</strong> The player holds legislative meetings to buy
                    coalitions and compromise with opposition red lines (e.g. removing a tax
                    proposal to gain union support).
                  </li>
                  <li>
                    <strong>Emergent Elections:</strong> Elections occur automatically on cyclical
                    dates, acting as a historical transition. The seats are redistributed based on a
                    voter model calculating your commitments' successes, failures, and party
                    platform alignment recorded on the timeline. No artificial modifiers.
                  </li>
                </ul>
              </FacetCard>

              {/* Foreign Affairs Loop Detail */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <div className="text-indigo-555 font-mono text-xs font-bold uppercase">
                  4. Foreign Affairs Domain (Diplomacy Replaced)
                </div>
                <p className="text-muted-foreground text-xs">
                  Governments do not "do diplomacy" — foreign ministries execute foreign policy.
                </p>
                <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-xs">
                  <li>
                    <strong>Embassies as Departments:</strong> Embassies are treated as local
                    departments consuming budget/CivCap to execute specific{" "}
                    <code>ForeignMission</code> objectives (e.g., trade generation, visa processing,
                    strategic intelligence).
                  </li>
                  <li>
                    <strong>Treaties as Living Programs:</strong> Treaties are commitment nodes in
                    the Intent Graph. They reserve budget/CivCap and require periodic Review
                    Meetings to maintain alignment.
                  </li>
                  <li>
                    <strong>Summits are Meetings:</strong> International G7-style talks, trade pact
                    negotiations, and war councils use the same <code>CabinetMeeting</code> engine.
                  </li>
                </ul>
              </FacetCard>
            </div>
          )}

          {activeTab === "concord" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 flex items-center gap-2 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  <Cpu className="h-6 w-6 text-indigo-500" />
                  Concord Simulation Engine Spec
                </h2>
                <div className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
                  Core World-State Simulation Core
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Concord is the world-scoped, time-driven living simulation engine that drives NPC
                  behaviors, dynamic diplomacy cycles, world crises, tick-time calendars (via{" "}
                  <code>ixtime.ts</code>), and calculates domestic stability coefficients from
                  economic policy outcomes.
                </p>
              </FacetCard>

              {/* Diplomatic Markov Chain Mathematics */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-sm font-semibold dark:text-white">
                  <Globe className="text-indigo-550 h-4 w-4" />
                  1. Diplomatic Markov Chain Mathematics
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  NPC relationships evolve dynamically based on player actions and external world
                  contexts modeled using a five-state Markov model:
                  <code className="text-indigo-555 bg-muted mt-1 block rounded p-1 text-center font-mono text-[10px]">
                    RelationshipState = &quot;hostile&quot; | &quot;tense&quot; |
                    &quot;neutral&quot; | &quot;friendly&quot; | &quot;allied&quot;
                  </code>
                </p>

                {/* Formula display */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Transition Probability Formula
                    </span>
                    <div className="text-foreground border-y border-indigo-500/10 py-2 text-center font-mono text-xs dark:text-white">
                      P(X<sub>t+1</sub> = s&apos; | X<sub>t</sub> = s) = P<sub>Base</sub> × (1 + M
                      <sub>Context</sub>)
                    </div>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      Where P<sub>Base</sub> is retrieved from a static baseline matrix. Negative
                      transitions (deterioration) are slightly easier than positive ones by design,
                      reflecting trust decay physics.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Weighted Context Modifier
                    </span>
                    <div className="text-foreground border-y border-indigo-500/10 py-2 text-center font-mono text-xs dark:text-white">
                      M<sub>Context</sub> = 0.4W<sub>Act</sub> + 0.25W<sub>Econ</sub> + 0.15W
                      <sub>Cult</sub> + 0.1W<sub>Geo</sub> + 0.1W<sub>Allies</sub>
                    </div>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      Player actions represent 40% of the drift direction, followed by economic
                      interdependence (25%), cultural affinity (15%), geography (10%), and alliance
                      blocs (10%).
                    </p>
                  </div>
                </div>

                {/* Detail weight formulas */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-foreground text-[11px] font-bold uppercase">
                    Specific Factor Calculations
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-border text-muted-foreground border-b">
                          <th className="w-1/4 py-2.5 font-semibold">Factor</th>
                          <th className="w-2/5 py-2.5 font-semibold">Formula / Condition</th>
                          <th className="py-2.5 font-semibold">Simulation Behavior</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border text-foreground divide-y dark:text-slate-300">
                        {[
                          {
                            factor: "W_Act (Positive Shift)",
                            formula: "W_Act = (Coop / 100) * 0.8 - (Aggr / 100) * 0.6",
                            behavior:
                              "Cooperative actions push relationship up; aggressive acts pull it down.",
                          },
                          {
                            factor: "W_Act (Negative Shift)",
                            formula: "W_Act = (Aggr / 100) * 0.8 - (Coop / 100) * 0.6",
                            behavior:
                              "High aggressive posture accelerates deterioration; coop acts resist it.",
                          },
                          {
                            factor: "W_Econ Modifier",
                            formula:
                              "Factor = Min(1, Trade / $10M) + (Growth / 20) + (Treaty ? 0.3 : 0) + (Sim / 100) * 0.2",
                            behavior:
                              "Strong trade networks resist negative transitions and support alliances.",
                          },
                          {
                            factor: "W_Cult Modifier",
                            formula:
                              "Factor = ExchangeImpact + Affinity / 100 + SharedLang ? 0.2 : 0",
                            behavior:
                              "Shared language (0.2) and cultural affinity lock relations into stable patterns.",
                          },
                          {
                            factor: "W_Geo Proximity",
                            formula: "Proximity = Adjacency ? 0.8 : (SameRegion ? 0.5 : 0.2)",
                            behavior:
                              "Adjacent border nations experience high drift friction (can improve or decay faster).",
                          },
                          {
                            factor: "W_Allies Blocs",
                            formula:
                              "Factor = Allies * 0.15 + Mediate ? 0.3 : 0 - CompetingBloc ? 0.5 : 0",
                            behavior:
                              "Opposing alliance structures apply a flat -0.5 penalty to trust transitions.",
                          },
                        ].map((row, idx) => (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="text-indigo-550 py-3 font-semibold">{row.factor}</td>
                            <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {row.formula}
                            </td>
                            <td className="text-muted-foreground py-3">{row.behavior}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Code implementation */}
                <div className="space-y-2">
                  <span className="text-foreground mb-1 block text-[10px] font-bold uppercase">
                    Code Implementation (src/lib/diplomatic-markov-engine.ts)
                  </span>
                  <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-md border p-3 font-mono text-[10px] dark:text-slate-300">
                    {`static calculateTransitionProbabilities(
  fromState: RelationshipState,
  toState: RelationshipState,
  context: TransitionContext
): number {
  const baseProbability = this.BASE_TRANSITION_MATRIX[fromState][toState];

  const actionWeight = this.calculateActionWeight(fromState, toState, context);
  const economicWeight = this.calculateEconomicWeight(fromState, toState, context);
  const culturalWeight = this.calculateCulturalWeight(fromState, toState, context);
  const geographicWeight = this.calculateGeographicWeight(fromState, toState, context);
  const allianceWeight = this.calculateAllianceWeight(fromState, toState, context);

  // Weighted combination (Total weights = 1.0)
  const contextualModifier =
    actionWeight * 0.4 +
    economicWeight * 0.25 +
    culturalWeight * 0.15 +
    geographicWeight * 0.1 +
    allianceWeight * 0.1;

  // Clamp final probability to valid range [0, 1]
  const adjustedProbability = baseProbability * (1 + contextualModifier);
  return Math.max(0, Math.min(1, adjustedProbability));
}`}
                  </pre>
                </div>
              </FacetCard>

              {/* Domestic Security & Stability Formulas */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-sm font-semibold dark:text-white">
                  <Activity className="text-indigo-555 h-4 w-4" />
                  2. Domestic Security & Stability Calculation Formulas
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Concord translates economic growth, inequality, Gini distributions, demographic
                  details, and ministry budgets into raw security metrics:
                </p>

                {/* Formula display */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Overall Crime Rate Formula
                    </span>
                    <div className="text-foreground border-y border-indigo-500/10 py-2 text-center font-mono text-xs leading-relaxed dark:text-white">
                      CrimeRate = 0.8U<sub>Rate</sub> + 15G<sub>Index</sub> + 0.6P<sub>Rate</sub> +
                      5U<sub>Ratio</sub> + W<sub>Policing</sub>
                    </div>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      U<sub>Rate</sub> = Unemployment Rate, G<sub>Index</sub> = Gini inequality
                      index (0-1), P<sub>Rate</sub> = Poverty Rate, U<sub>Ratio</sub> = Urbanization
                      Rate, W<sub>Policing</sub> = policing deficit index.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Organized Crime Index
                    </span>
                    <div className="text-foreground border-y border-indigo-500/10 py-2 text-center font-mono text-xs dark:text-white">
                      OrganizedCrime = 0.4C<sub>Idx</sub> + 8(2.5 - S<sub>Pol</sub>) + 0.3(100 - D
                      <sub>Idx</sub>)
                    </div>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      C<sub>Idx</sub> = Corruption Index, S<sub>Pol</sub> = political stability
                      index (-2.5 to 2.5), D<sub>Idx</sub> = democracy index (0-100).
                    </p>
                  </div>
                </div>

                {/* Code implementation */}
                <div className="space-y-2">
                  <span className="text-foreground mb-1 block text-[10px] font-bold uppercase">
                    Code Implementation (src/lib/stability-formulas.ts)
                  </span>
                  <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-md border p-3 font-mono text-[10px] dark:text-slate-300">
                    {`export function calculateCrimeRate(
  economic: EconomicData,
  demographic: DemographicData,
  government: GovernmentData
): { overall: number; violent: number; property: number } {
  const unemploymentFactor = economic.unemploymentRate * 0.8;
  const inequalityFactor = (economic.giniIndex / 100) * 15;
  const povertyFactor = economic.povertyRate * 0.6;
  const youthFactor = demographic.youthUnemployment * 0.4;
  const urbanFactor = (demographic.urbanizationRate / 100) * 5;

  // Policing per capita spending deficit calculation
  const policingPerCapita = government.policingBudget / Math.max(1, demographic.population);
  const policingFactor = Math.max(0, 10 - (policingPerCapita / 100) * 10);

  const baseCrimeRate =
    unemploymentFactor + inequalityFactor + povertyFactor + urbanFactor + policingFactor;

  const violentCrimeRate = Math.max(1, baseCrimeRate * 0.3 + youthFactor + povertyFactor * 0.5);
  const propertyCrimeRate = Math.max(
    5,
    baseCrimeRate * 0.7 + inequalityFactor + economic.inflationRate * 0.3
  );

  return {
    overall: Math.min(100, violentCrimeRate + propertyCrimeRate),
    violent: Math.min(50, violentCrimeRate),
    property: Math.min(80, propertyCrimeRate),
  };
}`}
                  </pre>
                </div>
              </FacetCard>

              {/* Time Sync Clock */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold dark:text-white">
                  <Terminal className="text-indigo-550 h-4 w-4" />
                  3. The Concord Tick Calendar Clock (ixtime.ts)
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Concord drives simulation progression on the server using the **IxTime clock**,
                  running at **2× real-time speed** (meaning 1 month of simulation ticks resolves in
                  ~15 days). Scheduled cron services (sports schedules, scheduled cabinet elections,
                  passive tax collection ticks) self-gate and execute tasks at standard intervals
                  linked to the global Concord calendar registry.
                </p>
              </FacetCard>

              {/* Cross-Pillar Engine */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-sm font-semibold dark:text-white">
                  <Network className="text-indigo-555 h-4 w-4" />
                  4. Cross-Pillar Interactions Engine
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Concord bridges the Executive, Diplomacy, and Politics pillars using
                  multidirectional feedback loops computed without side effects:
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Executive → Politics (Support)
                    </span>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      Political parties support or oppose active policies based on ideological
                      alignment (Left favors social/governance; Right favors economic). Magnitude is
                      influenced by Policy Priority (Critical 2.0x, High 1.5x, Medium 1.0x).
                    </p>
                  </div>
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Politics → Executive (Legislature)
                    </span>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      Legislative majority alignment modifies policy passage and effectiveness. An
                      aligned majority provides +20% effectiveness and 85% passage probability,
                      while opposing majorities enforce -30% effectiveness.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-foreground mb-1 block text-[10px] font-bold uppercase">
                    Code Implementation (src/lib/cross-pillar-engine.ts)
                  </span>
                  <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-md border p-3 font-mono text-[10px] dark:text-slate-300">
                    {`export function computePolicyPartyReactions(policies: PolicyData[], parties: PartyData[]) {
  // ...
  const alignment = policyLean * ideologyScore;
  if (alignment > 0) {
    supportDelta = Math.min(5, 1 + Math.abs(alignment)) * multiplier;
    stance = "support";
  } else if (alignment < 0) {
    supportDelta = -Math.min(5, 1 + Math.abs(alignment)) * multiplier;
    stance = "oppose";
  }
  // ...
}`}
                  </pre>
                </div>
              </FacetCard>

              {/* Intelligence Engine */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-sm font-semibold dark:text-white">
                  <Radar className="text-indigo-555 h-4 w-4" />
                  5. Advanced Intelligence Analysis Engine
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Generates actionable intelligence by detecting anomalies using modified Z-Scores
                  and MAD (Median Absolute Deviation) tailored for economic distributions.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Anomaly Detection (Z-Score & MAD)
                    </span>
                    <div className="text-foreground border-y border-indigo-500/10 py-2 text-center font-mono text-xs leading-relaxed dark:text-white">
                      Z<sub>Modified</sub> = (0.6745 × (X - Median)) / MAD
                    </div>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      Utilizes Median Absolute Deviation for economic metrics instead of standard
                      deviation to resist extreme outliers. Absolute Z-Scores &gt; 3.0 trigger
                      &quot;Critical&quot; alerts.
                    </p>
                  </div>
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Correlation Insights
                    </span>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      Uses Pearson correlation coefficients across historical series (GDP,
                      Population, Unemployment) to detect structural economic relationships (e.g.
                      |r| &gt; 0.8 is strong).
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-foreground mb-1 block text-[10px] font-bold uppercase">
                    Code Implementation (src/lib/intelligence-engine.ts)
                  </span>
                  <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-md border p-3 font-mono text-[10px] dark:text-slate-300">
                    {`function calculateModifiedZScore(value: number, median: number, mad: number): number {
  if (mad === 0) return 0;
  return (0.6745 * (value - median)) / mad;
}

export function detectAnomalies(current: number, historical: number[], metric: string, category: string) {
  // ...
  const effectiveZScore = category === "economic" ? modifiedZScore : zScore;
  if (Math.abs(effectiveZScore) > 3.0) severity = "critical";
  else if (Math.abs(effectiveZScore) > 2.5) severity = "high";
  // ...
}`}
                  </pre>
                </div>
              </FacetCard>

              {/* Economic Modeling Engine */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-sm font-semibold dark:text-white">
                  <TrendingUp className="text-indigo-555 h-4 w-4" />
                  6. Economic Modeling Engine
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Performs multi-year GDP projections, applies temporal policy effects, and computes
                  a Model Health score.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Macro Projections
                    </span>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      GDP and Population projections compound annually, modified by specific
                      temporal policy effects (e.g., structural stimulus active from 2024–2028).
                    </p>
                  </div>
                  <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <span className="text-indigo-555 text-[10px] font-bold uppercase">
                      Model Health Assessor
                    </span>
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      Generates a 0-100 score: +10 pts for optimal GDP growth (2-5%), +10 pts for
                      optimal inflation (1-3%), and heavy penalties for unemployment &gt; 15% or
                      high deficits.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-foreground mb-1 block text-[10px] font-bold uppercase">
                    Code Implementation (src/lib/economic-modeling-engine.ts)
                  </span>
                  <pre className="bg-muted/50 border-border text-foreground overflow-x-auto rounded-md border p-3 font-mono text-[10px] dark:text-slate-300">
                    {`export function calculateModelHealth(parameters: ModelParameters): ModelHealth {
  let score = 70; // Base score
  // GDP Growth Assessment (optimal: 2-5%)
  if (parameters.gdpGrowthRate >= 2 && parameters.gdpGrowthRate <= 5) score += 10;
  else if (parameters.gdpGrowthRate < 0) score -= 15;

  // Fiscal Balance Assessment (optimal: ±3%)
  if (Math.abs(parameters.fiscalBalance) <= 3) score += 5;
  else if (Math.abs(parameters.fiscalBalance) > 10) score -= 10;
  // ...
  const status = score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 55 ? "fair" : "poor";
  return { score, status, warnings };
}`}
                  </pre>
                </div>
              </FacetCard>
            </div>
          )}

          {activeTab === "loops-ux" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              {/* Gameplay Loops */}
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Gameplay Loops & UX Commandments
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The MyCountry engine coordinates 9 distinct governing loops that continuously feed
                  options, expectations, and political friction into one another.
                </p>
              </FacetCard>

              {/* React Flow loops connection & Loop Inspector */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* React Flow Container */}
                <FacetCard depth={2} className="space-y-4 p-5 xl:col-span-2">
                  <h3 className="text-foreground text-sm font-semibold dark:text-white">
                    Inter-Loop Dependency Topology
                  </h3>
                  <p className="text-muted-foreground text-[11px]">
                    Click any node in the interactive graph below to dynamically expand and inspect
                    its action steps, verbs, and sub-simulation stages:
                  </p>
                  <div
                    ref={loopsRef}
                    onClick={() => setIsLoopsFocused(true)}
                    className={`bg-muted/20 relative h-[400px] overflow-hidden rounded-lg border transition-all duration-300 ${
                      isLoopsFocused
                        ? "ring-indigo-505/50 border-indigo-505/50 shadow-lg ring-2 shadow-indigo-500/5"
                        : "border-border"
                    }`}
                  >
                    {isLoopsFocused && (
                      <div className="animate-in fade-in zoom-in absolute top-2 right-12 z-10 flex items-center gap-1.5 rounded bg-indigo-500/90 px-2 py-1 font-mono text-[9px] tracking-tight text-white shadow-md duration-200">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
                        Active: Scroll to Zoom | Click Out to Release
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLoopsMaximized(true);
                      }}
                      title="Maximize Visualizer"
                      className="bg-background/80 hover:bg-background border-border text-muted-foreground hover:text-foreground absolute top-2 right-2 z-10 cursor-pointer rounded-md border p-1.5 shadow-md transition-colors"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="h-full min-h-[300px] w-full flex-1">
                      <ReactFlow
                        nodes={loopNodes}
                        edges={loopEdges}
                        nodeTypes={nodeTypes}
                        fitView
                        onNodeClick={onNodeClick}
                        preventScrolling={isLoopsFocused}
                        zoomOnScroll={isLoopsFocused}
                        nodesConnectable={false}
                        nodesDraggable={false}
                      >
                        <Background color="#ccc" gap={16} size={1} />
                        <Controls className="!bg-background !border-border !fill-foreground [&>button]:!border-border hover:[&>button]:!bg-muted" />
                      </ReactFlow>
                    </div>
                  </div>
                </FacetCard>

                {/* Loop Breakdown Inspector */}
                <FacetCard
                  depth={3}
                  className="flex flex-col justify-between space-y-5 p-5 xl:col-span-1"
                >
                  {!currentLoopDetail ? (
                    <div className="text-muted-foreground my-auto flex h-full flex-col items-center justify-center p-6 text-center">
                      <Sliders className="mb-2 h-8 w-8 animate-pulse text-indigo-500 opacity-40" />
                      <p className="text-xs">
                        Select any gameplay loop node in the topology diagram to inspect its
                        operational sequence and steps.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-505 font-mono text-[10px] font-extrabold tracking-widest uppercase">
                            Loop Inspector
                          </span>
                          <Badge
                            variant="outline"
                            className="text-indigo-505 border-indigo-500/20 bg-indigo-500/5 font-mono text-[9px]"
                          >
                            Active
                          </Badge>
                        </div>
                        <h3 className="text-foreground border-border border-b pb-2 text-base font-bold tracking-tight dark:text-white">
                          {currentLoopDetail.title}
                        </h3>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {currentLoopDetail.description}
                        </p>

                        {/* Steps list */}
                        <div className="space-y-3.5 pt-1">
                          <h4 className="text-foreground text-[10px] font-bold tracking-wider uppercase">
                            Operational Sequence
                          </h4>
                          <ol className="text-muted-foreground space-y-2 pl-1 text-xs">
                            {currentLoopDetail.steps.map((step, idx) => (
                              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                                <span className="text-indigo-505 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 font-mono text-[9px] font-bold">
                                  {idx + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>

                      {/* Verbs and backend hooks */}
                      <div className="border-border mt-4 space-y-3 border-t pt-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-foreground mr-1 text-[9px] font-bold uppercase">
                            Grammar:
                          </span>
                          {currentLoopDetail.verbs.map((verb) => (
                            <Badge
                              key={verb}
                              variant="secondary"
                              className="bg-muted text-indigo-550 py-0 font-mono text-[9px] font-bold"
                            >
                              {verb}
                            </Badge>
                          ))}
                        </div>
                        <div>
                          <span className="text-foreground mb-1 block text-[9px] font-bold uppercase">
                            Backend Hook:
                          </span>
                          <p className="text-muted-foreground bg-muted/50 border-border rounded border p-2 font-mono text-[10px] leading-relaxed">
                            {currentLoopDetail.mechanics}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </FacetCard>
              </div>

              {/* Loops grid */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  The Nine Gameplay Loops
                </h3>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
                  {[
                    {
                      title: "Macro Loop",
                      desc: "Vision -> agenda -> commitments -> consequences -> history -> new agenda.",
                    },
                    {
                      title: "Meeting Loop",
                      desc: "Intent -> convene -> debate -> options -> authorization -> minutes.",
                    },
                    {
                      title: "Policy Loop",
                      desc: "Problem -> draft -> negotiate -> enact -> implement -> review.",
                    },
                    {
                      title: "Foreign Affairs",
                      desc: "Aim -> contact -> summit -> agreement -> reaction -> relationship memory.",
                    },
                    {
                      title: "Legislature",
                      desc: "Agenda -> party manifestos -> negotiations -> bill vote -> implementation.",
                    },
                    {
                      title: "Crisis Loop",
                      desc: "Shock -> emergency meeting -> triage -> order -> consequence -> inquiry.",
                    },
                    {
                      title: "Opportunity Loop",
                      desc: "Opening -> assess -> commit -> complication -> payoff or failure.",
                    },
                    {
                      title: "Legacy Loop",
                      desc: "Decision -> chain reaction -> remembered era -> national identity.",
                    },
                    {
                      title: "Regional Loop",
                      desc: "Place -> need -> investment -> local resistance -> development record.",
                    },
                  ].map((loop, idx) => (
                    <div key={idx} className="bg-muted/40 border-border rounded-md border p-3">
                      <span className="text-foreground mb-1 block font-bold dark:text-white">
                        {loop.title}
                      </span>
                      {loop.desc}
                    </div>
                  ))}
                </div>
              </FacetCard>

              {/* UX Commandments */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  UX Commandments
                </h3>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                  {[
                    {
                      title: "1. Begin with a goal",
                      desc: "Policy, diplomacy, defense, budgets, and development should be entered through player intent whenever possible.",
                    },
                    {
                      title: "2. Never make numbers the fantasy",
                      desc: "Expose metrics as evidence, warnings, and consequences. Do not make the player feel like the job is tuning sliders.",
                    },
                    {
                      title: "3. Dashboard shows today's focus",
                      desc: "Urgency should be organized around agenda, capacity, crisis, promises, and review, not arbitrary notifications.",
                    },
                    {
                      title: "4. Meetings are playable",
                      desc: "They must produce meaningful disagreement, trade-offs, recommendations, and executable plans.",
                    },
                    {
                      title: "5. Complexity from interaction",
                      desc: "Keep the first layer simple. Let depth appear when intent meets institutions, brokers, information limits, and consequences.",
                    },
                    {
                      title: "6. Always show why this is hard",
                      desc: "Pushback should be specific and believable: who objects, what capacity is missing, which law blocks it, what data is uncertain.",
                    },
                    {
                      title: "7. Advanced control is optional",
                      desc: "Expert players can inspect details and tune plans, but new players should still be able to govern through intent.",
                    },
                    {
                      title: "8. Every commitment deserves review",
                      desc: "After execution, the player should learn what happened, who reacted, what changed, and what choices remain.",
                    },
                    {
                      title: "9. History is beautiful and useful",
                      desc: "The timeline is not a log dump. It is the player's national memory and the substrate for future gameplay.",
                    },
                    {
                      title: "10. Do not strand mechanics",
                      desc: "If a subsystem cannot express intent, deliberation, commitment, reaction, or history, redesign it until it can.",
                    },
                  ].map((rule, idx) => (
                    <div key={idx} className="bg-muted/40 border-border rounded-md border p-3">
                      <span className="text-foreground mb-1 block font-bold dark:text-white">
                        {rule.title}
                      </span>
                      {rule.desc}
                    </div>
                  ))}
                </div>
              </FacetCard>

              {/* Player Journey */}
              <FacetCard depth={2} className="p-5">
                <h3 className="text-foreground mb-3 text-sm font-semibold dark:text-white">
                  Player Journey
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b">
                        <th className="w-1/4 py-2.5 font-semibold">Stage</th>
                        <th className="w-2/5 py-2.5 font-semibold">Player Experience</th>
                        <th className="py-2.5 font-semibold">Design Goal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border text-foreground divide-y dark:text-slate-300">
                      {[
                        {
                          stage: "Hour 1",
                          experience:
                            "Define a country, choose a governing vision, declare the first intent, hold a first cabinet meeting.",
                          goal: "Make the player feel they are governing within minutes.",
                        },
                        {
                          stage: "First Week",
                          experience:
                            "Run several agenda items, see stakeholder reactions, adapt one plan, read first history entries.",
                          goal: "Teach that commitments have memory.",
                        },
                        {
                          stage: "First Month",
                          experience:
                            "Balance competing objectives, capacity strain, broker demands, diplomacy, and one crisis or opportunity.",
                          goal: "Make trade-offs feel political rather than mathematical.",
                        },
                        {
                          stage: "First Year",
                          experience:
                            "Complete or abandon milestones, build a recognizable national direction, inherit consequences from earlier decisions.",
                          goal: "Reveal the legacy loop.",
                        },
                        {
                          stage: "Veteran",
                          experience:
                            "Use deep policy controls, cross-player diplomacy, regional planning, defense posture, and historical strategy.",
                          goal: "Reward mastery without abandoning intent-first play.",
                        },
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="text-foreground py-3 font-semibold dark:text-white">
                            {row.stage}
                          </td>
                          <td className="text-muted-foreground py-3">{row.experience}</td>
                          <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {row.goal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FacetCard>
            </div>
          )}

          {activeTab === "branding" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  IxStates Brand Architecture & Platform Subsystems
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Detailed blueprint covering all core applications, version registers, and
                  foundational infrastructure in the IxStates ecosystem.
                </p>
              </FacetCard>

              {/* Brand Architecture */}
              <FacetCard depth={2} className="space-y-3 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  Subsystem Dependency Architecture
                </h3>
                <div className="bg-muted/50 border-border text-foreground space-y-2 overflow-x-auto rounded-lg border p-4 font-mono text-xs dark:text-slate-300">
                  <div>IxStates (platform/ecosystem) ← versioned: 1.1.1 "Ogma" (Alpha)</div>
                  <div className="border-border ml-3 border-l py-1 pl-6">
                    <div>├── Active Apps:</div>
                    <div className="border-border ml-3 border-l py-1 pl-6">
                      <div>
                        ├── <strong>IxWorld (Maps):</strong> Spatial geography and choropleths
                        (#06b6d4)
                      </div>
                      <div>
                        ├── <strong>WikiOS (Knowledge):</strong> PlateJS client-side renderer and
                        Parsoid parsing (#ffffff)
                      </div>
                      <div>
                        ├── <strong>IxVault (Economy):</strong> Cards marketplace, booster packs,
                        currency ledger (#eab308)
                      </div>
                      <div>
                        └── <strong>IxForum (Community):</strong> XenForo community forums API
                        integration (#f97316)
                      </div>
                    </div>
                    <div>├── Core Simulation Engines:</div>
                    <div className="border-border ml-3 border-l py-1 pl-6">
                      <div>
                        ├── <strong>MyCountry:</strong> Sovereign administration, departments, and
                        cabinet sim
                      </div>
                      <div>
                        ├── <strong>Concord:</strong> Real-time demographic, social, and economic
                        calculations
                      </div>
                      <div>
                        └── <strong>Atlas:</strong> Spatial hub calculations and procedural world
                        generation
                      </div>
                    </div>
                    <div>├── Platform Utilities:</div>
                    <div className="border-border ml-3 border-l py-1 pl-6">
                      <div>
                        ├── <strong>IxTime:</strong> Clock scheduler managing tick timers & seed
                        intervals
                      </div>
                      <div>
                        └── <strong>IxnayID:</strong> Universal single sign-on security credential
                        routing
                      </div>
                    </div>
                  </div>
                </div>
              </FacetCard>

              {/* App Specifications */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  Active Applications Specs
                </h3>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground text-cyan-505 mb-1 block font-bold dark:text-white">
                      IxWorld (Maps)
                    </span>
                    Managed by <code>maps.prisma</code> schema. Features choropleths (Geopolitical,
                    Risk, Georegions), dynamic trade route visualizers, a Forge mode for
                    administrators, and a fully interactive SVG path-based borders editor.
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground text-amber-505 mb-1 block font-bold dark:text-white">
                      IxVault (Economy)
                    </span>
                    Core card marketplace, booster packs purchases, tax rates, and a custom currency
                    ledger. Runs on Redis for fast auction transactions and updates values through
                    weekly card value crons.
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground text-orange-505 mb-1 block font-bold dark:text-white">
                      IxForum (Community)
                    </span>
                    Seamless hybrid routing proxy connecting user profiles to an external XenForo
                    community installation. Uses card ratings and profile cards embedded directly in
                    forum posts.
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground text-foreground mb-1 block font-bold dark:text-white">
                      WikiOS (Knowledge)
                    </span>
                    Platform-wide sharing portal replacing the old MediaWiki layout. Uses a
                    customized Next.js frontend with Slate/PlateJS editor, mapping pages directly to
                    sovereign nation timelines.
                  </div>
                </div>
              </FacetCard>

              {/* Infrastructure */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  Core Infrastructure & Services
                </h3>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
                  <div>
                    <span className="text-foreground mb-1 block flex items-center gap-1 font-bold dark:text-white">
                      <Activity className="h-3.5 w-3.5" /> WebSocket Feeds
                    </span>
                    Production-only custom Socket.IO server tracking live intelligence feeds, sports
                    matches, and market operations.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block flex items-center gap-1 font-bold dark:text-white">
                      <Terminal className="h-3.5 w-3.5" /> Redis Cache
                    </span>
                    Enforces API rate limiting and provides rapid in-memory caching to optimize page
                    loads across 210+ Next.js routes.
                  </div>
                  <div>
                    <span className="text-foreground mb-1 block flex items-center gap-1 font-bold dark:text-white">
                      <AlertOctagon className="h-3.5 w-3.5" /> Disk & PG Guard
                    </span>
                    Automated system monitoring. Logs warning states (journald, logrotate) and uses
                    Discord webhook scripts to trigger alerts when storage is constrained.
                  </div>
                </div>
              </FacetCard>
            </div>
          )}

          {activeTab === "playground" && (
            <div className="animate-in fade-in space-y-6 duration-300">
              <FacetCard depth={1} className="space-y-4 p-6">
                <h2 className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
                  Facet Design System
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Facet is the custom glass-refraction design system of IxStates. It is built to
                  create volumetric depth and physical material realism using glass blurs, HSL
                  transparency, and Apple-style spring scaling response profiles.
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                  <div className="text-xs leading-relaxed text-indigo-900 dark:text-indigo-200">
                    <span className="text-foreground mb-1 block font-bold dark:text-white">
                      Practical Usefulness:
                    </span>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      <li>
                        <strong>Hierarchy through Z-index:</strong> Visually enforces importance.
                        Base items (d:1) stack underneath overlays (d:3) and urgent dialog modals
                        (d:4).
                      </li>
                      <li>
                        <strong>Prevents Slider/Spreadsheet Fatigue:</strong> Turns dry columns of
                        numbers into tangible physical widgets that players can press, depth-adjust,
                        and interact with.
                      </li>
                      <li>
                        <strong>Dynamic Luminance Adaptation:</strong> Heuristically reads parent
                        background brightness to balance light/dark border contrast, keeping
                        interfaces accessible.
                      </li>
                    </ul>
                  </div>
                </div>
              </FacetCard>

              {/* Volumetric Layering Specification */}
              <FacetCard depth={2} className="space-y-4 p-5">
                <h3 className="text-foreground text-sm font-semibold dark:text-white">
                  Volumetric Z-Depth Specification
                </h3>
                <div className="text-muted-foreground grid grid-cols-1 gap-4 text-xs md:grid-cols-4">
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground mb-1 block font-bold text-indigo-400 dark:text-white">
                      Depth 1: Base
                    </span>
                    Backdrop blur: <code>blur-moderate</code>.<br />
                    Background: <code>var(--facet-bg-1)</code>.<br />
                    Use: list details, container backdrops, background cards.
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground mb-1 block font-bold text-blue-400 dark:text-white">
                      Depth 2: Floating
                    </span>
                    Backdrop blur: <code>blur-prominent</code>.<br />
                    Background: <code>var(--facet-bg-2)</code>.<br />
                    Use: navigation items, main dashboard widgets, buttons.
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground mb-1 block font-bold text-purple-400 dark:text-white">
                      Depth 3: Overlay
                    </span>
                    Backdrop blur: <code>blur-intense</code>.<br />
                    Background: <code>var(--facet-bg-3)</code>.<br />
                    Use: popovers, floating selectors, context tooltips.
                  </div>
                  <div className="bg-muted/40 border-border rounded-md border p-3">
                    <span className="text-foreground mb-1 block font-bold text-cyan-400 dark:text-white">
                      Depth 4: Modal
                    </span>
                    Backdrop blur: <code>blur-intense</code>.<br />
                    Background: <code>var(--facet-bg-4)</code>.<br />
                    Use: urgent alerts, cabinet vote popups, system dialogs.
                  </div>
                </div>
              </FacetCard>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Configuration Panel */}
                <FacetCard depth={2} className="space-y-6 p-5">
                  <h3 className="text-foreground text-sm font-semibold dark:text-white">
                    Configure Facet Props
                  </h3>

                  {/* Variant Selection */}
                  <div className="space-y-2">
                    <label className="text-muted-foreground text-xs font-medium">
                      Variant Profile
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "base",
                        "mycountry",
                        "global",
                        "economy",
                        "military",
                        "cultural",
                        "security",
                        "forum",
                        "builder",
                      ].map((v) => (
                        <button
                          key={v}
                          onClick={() => setPlaygroundVariant(v)}
                          className={`rounded border px-2.5 py-1 font-mono text-[10px] font-bold uppercase transition-all ${
                            playgroundVariant === v
                              ? "border-indigo-505 text-indigo-555 bg-indigo-500/10"
                              : "border-border bg-muted/40 text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Depth Selection */}
                  <div className="space-y-2">
                    <label className="text-muted-foreground block text-xs font-medium">
                      Volumetric Depth (Z-axis)
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((d: any) => (
                        <button
                          key={d}
                          onClick={() => setPlaygroundDepth(d)}
                          className={`flex-1 rounded border py-1.5 font-mono text-xs font-bold transition-all ${
                            playgroundDepth === d
                              ? "text-indigo-555 border-indigo-500 bg-indigo-500/10"
                              : "border-border bg-muted/40 text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          Depth {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactivity Selection */}
                  <div className="space-y-2">
                    <label className="text-muted-foreground block text-xs font-medium">
                      Interactivity Mode
                    </label>
                    <div className="flex gap-2">
                      {["none", "hover", "click"].map((i) => (
                        <button
                          key={i}
                          onClick={() => setPlaygroundInteractivity(i)}
                          className={`flex-1 rounded border py-1.5 font-mono text-xs font-bold transition-all ${
                            playgroundInteractivity === i
                              ? "text-indigo-555 border-indigo-500 bg-indigo-500/10"
                              : "border-border bg-muted/40 text-muted-foreground hover:border-border/80"
                          }`}
                        >
                          {i.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Refraction Toggle */}
                  <div className="border-border flex items-center justify-between border-t pt-4">
                    <div>
                      <span className="text-foreground block text-xs font-medium dark:text-white">
                        Glass Refraction Sheen
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Apply light borders mimicking glass physics
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={playgroundRefraction ? "default" : "outline"}
                      onClick={() => setPlaygroundRefraction(!playgroundRefraction)}
                      className="text-xs"
                    >
                      {playgroundRefraction ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                </FacetCard>

                {/* Preview Panel */}
                <div className="space-y-4">
                  <h3 className="text-foreground text-sm font-semibold dark:text-white">
                    Live Spec Preview
                  </h3>

                  {/* Live Render */}
                  <div className="bg-muted/40 border-border flex min-h-[180px] items-center justify-center rounded-lg border p-8">
                    <FacetContainer
                      variant={playgroundVariant}
                      depth={playgroundDepth}
                      interactive={playgroundInteractivity}
                      enableRefraction={playgroundRefraction}
                      className="w-full max-w-[280px] space-y-3 p-6"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-muted-foreground font-mono text-[9px] tracking-widest uppercase">
                          Preview card
                        </span>
                        <Badge
                          variant="outline"
                          className="border-indigo-500/30 bg-indigo-500/5 font-mono text-[9px] text-indigo-500"
                        >
                          d:{playgroundDepth}
                        </Badge>
                      </div>
                      <h4 className="text-foreground text-sm font-bold tracking-tight uppercase dark:text-white">
                        Interactive Glass
                      </h4>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Hover over or click this card to observe the volumetric springs and
                        refraction shifts.
                      </p>
                    </FacetContainer>
                  </div>

                  {/* Code snippet */}
                  <div className="relative">
                    <pre className="bg-muted/40 border-border overflow-x-auto rounded-md border p-3 font-mono text-[10px] text-indigo-600 dark:text-indigo-300">
                      {`<FacetContainer
  variant="${playgroundVariant}"
  depth={${playgroundDepth}}
  interactive="${playgroundInteractivity}"
  enableRefraction={${playgroundRefraction}}
  className="p-6"
>
  <h4>Interactive Glass</h4>
</FacetContainer>`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Maximized Backend Visualizer Portal Overlay */}
      {isBackendMaximized && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="border-border bg-background/98 ring-indigo-505/50 animate-in fade-in zoom-in fixed inset-4 z-[200] flex flex-col overflow-hidden rounded-xl border p-6 shadow-2xl ring-2 backdrop-blur-md duration-200 md:inset-10"
        >
          <div className="border-border mb-4 flex shrink-0 flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Cpu className="text-indigo-550 h-5 w-5" />
              <div>
                <h3 className="text-foreground text-sm font-bold">
                  Backend Architecture Connections
                </h3>
                <p className="text-muted-foreground text-[10px]">
                  Interactive Fullscreen Visualizer
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBackendMaximized(false)}
              className="flex h-8 items-center gap-1.5 self-start text-xs sm:self-center"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Close Fullscreen
            </Button>
          </div>

          <div className="relative h-full min-h-0 w-full flex-1">
            <ReactFlow
              nodes={backendNodes}
              edges={backendEdges}
              nodeTypes={nodeTypes}
              fitView
              onNodeClick={onBackendNodeClick}
              preventScrolling={true}
              zoomOnScroll={true}
              nodesConnectable={false}
              nodesDraggable={false}
            >
              <Background color="#ccc" gap={16} size={1} />
              <Controls className="!bg-background !border-border !fill-foreground [&>button]:!border-border hover:[&>button]:!bg-muted" />
            </ReactFlow>
          </div>
        </div>
      )}

      {/* Maximized Loops Visualizer Portal Overlay */}
      {isLoopsMaximized && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="border-border bg-background/98 ring-indigo-505/50 animate-in fade-in zoom-in fixed inset-4 z-[200] flex flex-col overflow-hidden rounded-xl border p-6 shadow-2xl ring-2 backdrop-blur-md duration-200 md:inset-10"
        >
          <div className="border-border mb-4 flex shrink-0 flex-col justify-between gap-3 border-b pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Sliders className="text-indigo-550 h-5 w-5" />
              <div>
                <h3 className="text-foreground text-sm font-bold">
                  Inter-Loop Dependency Topology
                </h3>
                <p className="text-muted-foreground text-[10px]">
                  Interactive Fullscreen Visualizer
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsLoopsMaximized(false)}
              className="flex h-8 items-center gap-1.5 self-start text-xs sm:self-center"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Close Fullscreen
            </Button>
          </div>

          <div className="relative h-full min-h-0 w-full flex-1">
            <ReactFlow
              nodes={loopNodes}
              edges={loopEdges}
              nodeTypes={nodeTypes}
              fitView
              onNodeClick={onNodeClick}
              preventScrolling={true}
              zoomOnScroll={true}
              nodesConnectable={false}
              nodesDraggable={false}
            >
              <Background color="#ccc" gap={16} size={1} />
              <Controls className="!bg-background !border-border !fill-foreground [&>button]:!border-border hover:[&>button]:!bg-muted" />
            </ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}
