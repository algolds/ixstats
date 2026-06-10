Libraries like FlightCN for IxMaps (Rail / Highway / Shipping)
🧠 1. Core “FlightCN equivalents” (route graph + path engine)

These are the closest conceptual matches to FlightCN’s network simulation layer.

🟢 GraphHopper

GraphHopper

Java-based routing engine used in real navigation systems
Supports:
car / bike / foot routing
custom profiles (perfect for rail + shipping extension)
turn restrictions + edge weighting
Strong fit for:
highway networks
rail line simulation (with custom profiles)

👉 Best for: road + rail + mixed transport graph engine

🟢 OSRM (Open Source Routing Machine)

OSRM

Extremely fast C++ routing backend
Designed for:
road networks at global scale
turn-by-turn routing graphs
Not rail-native, but:
you can “fake rails” via custom OSM layers

👉 Best for: highway + real-time route computation

🟢 Valhalla

Valhalla Routing Engine

More flexible than OSRM
Supports:
multimodal routing (walking + transit + driving)
costing models (VERY useful for your simulation layer)
Easier to extend into:
rail networks
ferry + shipping links

👉 Best for: IxWorld-style multi-system routing logic

🚆 2. Rail + Transit-specific systems
🟣 OpenTripPlanner (OTP)

OpenTripPlanner

Designed for:
trains
subways
buses
scheduled transit graphs
Uses GTFS-style schedules
Very relevant if you want:
timetables
simulation of rail traffic flow

👉 Best for: rail networks with schedules + timetables

🟣 Transitland (data ecosystem)

Transitland

Not a router itself, but:
massive transit dataset aggregation layer
Useful for:
feeding rail networks into your simulation engine
🚢 3. Shipping / Maritime route systems

This is the hardest category because most tools are GIS-heavy rather than routing-heavy.

🟡 OpenSeaMap ecosystem

OpenSeaMap

Provides:
sea routes
buoy networks
maritime infrastructure
Can be used to:
generate shipping lanes
port-to-port graph networks

👉 Best for: global shipping lane base layer

🟡 NetworkX (custom maritime simulation backbone)

NetworkX

Not domain-specific but extremely powerful for:
custom shipping graph simulation
economic trade routing layers
probabilistic route flow modeling
Perfect for IxWorld “Exchange / Trade system” integration
🧩 4. Visualization layers (FlightCN-style rendering)

These plug directly into MapLibre like your IxMaps system.

🟦 deck.gl

deck.gl

Best-in-class for:
animated routes (planes, ships, trains)
arcs, paths, flows
GPU-accelerated rendering
Used for:
flight paths
shipping lanes
traffic simulation overlays

👉 This is the closest thing to “FlightCN visuals at scale”

🟦 turf.js

Turf.js

You already use this indirectly in your map system
Useful for:
route interpolation
distance weighting
path smoothing (Bezier / spline-like effects)
🧭 5. Map-native route layering (perfect for IxWorld)
🟩 Mapbox / MapLibre route plugins

MapLibre GL JS

Since you already use MapLibre:
you can build “FlightCN-like layers” as:
GeoJSON sources
animated line layers
symbol layers (moving icons)
⚙️ 6. Specialized simulation / traffic flow systems
🟠 MATSim

MATSim

Used in academic transport modeling
Can simulate:
congestion
rail load balancing
traffic behavior over time

👉 Heavy but powerful for:

IxWorld “Defense / Logistics / Economy simulation”
🧠 Recommended IxMaps Architecture (FlightCN-like system)

Given your stack, the cleanest setup is:

🚀 Layer 1 — Graph Engine
Valhalla (primary)
GraphHopper (fallback / custom rail profiles)
NetworkX (simulation + economic overlay)
🎯 Layer 2 — Domain Models
RailGraph (scheduled edges + timetables)
HighwayGraph (cost-based routing)
ShippingGraph (port nodes + sea lanes)
🎨 Layer 3 — Visualization
MapLibre GL JS (base rendering)
deck.gl (animated routes + flows)
Turf.js (geometry + smoothing)
🧠 Layer 4 — Simulation Layer (your “FlightCN brain”)

You’d build:

route congestion model
probabilistic travel time
economic flow weighting
dynamic rerouting events
💡 If you want something closer to “FlightCN specifically”

FlightCN-style systems usually combine:

graph routing engine (Valhalla / GraphHopper)
animation engine (deck.gl)
real-time state simulation layer (custom)

So the closest match stack overall is:

🟣 Valhalla + 🟦 deck.gl + 🟡 NetworkX + MapLibre GL JS

If you want next step

I can design a “IxTransport System PRD” that mirrors FlightCN but expands into:

Rail networks with timetables
Shipping lane economics
Highway congestion simulation
Dynamic war/disruption rerouting (Defense integration)
Trade flow visualization (Exchange system tie-in)

Just say.

the feature is called Routes but yes design a PRD with flightcn and whatever other tools etc

Below is a proper PRD for “Routes” (IxMaps / IxWorld) designed as a FlightCN-inspired multi-domain transport simulation + visualization system spanning rail, highways, shipping, and optional air-like flow systems.

This is written to plug directly into your existing IxWorld architecture (MapLibre + tRPC + procedural world + editor tools).

🧭 PRD — IxWorld Routes System
(“Routes” — Transport Graph & Flow Simulation Layer)
1. Overview
Product Name

Routes (working name)

Context

Routes is the unified transport graph system inside IxWorld that models and visualizes:

🚆 Rail networks (scheduled + infrastructure-based)
🚗 Highway / road networks (cost-based routing)
🚢 Shipping lanes (port-to-port maritime flow)
✈️ Optional: aerial flow abstraction (FlightCN-style arcs for economy/logistics simulation)

It functions as both:

A simulation engine (backend graph + cost model)
A visualization layer (MapLibre + deck.gl overlays)
2. Goals
Primary Goal

Create a FlightCN-style dynamic route visualization system, but expanded into a full geopolitical transport simulation layer for IxWorld.

Secondary Goals
Enable real-time route generation and editing inside Map Editor
Support economic + military + diplomatic routing overlays
Enable AI-driven or procedural route generation
Integrate with:
Defense system (supply lines)
Exchange system (trade flow)
Diplomacy system (embassy + influence networks)
3. Non-Goals (for v1)
Real-world GPS accuracy
Real-time traffic ingestion
True aviation physics simulation
Multiplayer real-time synchronization (later phase)
4. Core Concept

Routes is a multi-layer graph system:

Nodes:
  - Cities
  - Ports
  - Stations
  - Junctions
  - Border crossings

Edges:
  - Roads
  - Rail lines
  - Sea lanes
  - Ferry routes

Each edge has:

cost (time, money, risk)
capacity
ownership (country / entity)
mode type
strategic value
5. System Architecture
5.1 Core Routing Engine (Backend)
Recommended Stack
Layer	Tool
Road/rail routing	Valhalla Routing Engine
High-performance road fallback	OSRM
Rail + schedule simulation	OpenTripPlanner
Graph abstraction layer	NetworkX
IxWorld Custom Layer (critical)

You will still build a custom IxRoutes Graph Engine on top:

IxRouteGraph
IxRouteEdge
IxRouteNode
IxRoutePolicyEngine
5.2 Visualization Layer (Frontend)
Purpose	Tool
Base map rendering	MapLibre GL JS
Animated routes / flows	deck.gl
Geospatial math	Turf.js
6. Feature Set
6.1 Route Types (Core Abstraction)
🚆 Rail Routes
Scheduled timetables (optional simulation mode)
Fixed infrastructure graph
Capacity-based congestion
Station hierarchies
🚗 Highway Routes
Fastest-path routing (cost-based)
Border crossing penalties
Infrastructure quality modifiers
🚢 Shipping Routes
Port-to-port graph
Ocean lane corridors
Weather + risk modifiers (future)
Trade volume weighting
✈️ FlightCN-style “Flow Routes” (Abstract Layer)
Not literal flights — instead:
economic flows
troop movement simulations
diplomatic influence arcs
Rendered as animated arcs (deck.gl PathLayer style)
6.2 Routing Engine Features
Core Algorithms
Dijkstra (baseline)
A* (fast UI routing)
Contraction Hierarchies (Valhalla/OSRM style optimization)
Multi-cost routing (time, risk, cost, diplomacy weight)
Custom IxWorld Enhancements
Political friction cost
War zone avoidance penalty
Trade preference bias
Sovereignty restrictions (cross-border rules)
6.3 Visualization System (FlightCN-style layer)
Route Rendering Types
Solid lines → highways/rail
Dashed lines → inactive / proposed routes
Animated flow lines → trade/shipping/military movement
Pulsing nodes → hubs (cities/ports/stations)
deck.gl Layers Used
PathLayer → routes
ArcLayer → intercontinental flows
ScatterplotLayer → hubs
TextLayer → route labels
IconLayer → stations/ports
6.4 Route Editor Integration (IxEditor)

Routes integrates directly into:

/mycountry/map-editor

Tools:
Route creation (T tool already exists in your editor)
Snap-to:
cities
ports
border crossings
Manual spline editing
Auto-generated routes (AI / procedural)
Editor Modes:
Manual Mode
Auto Route Mode
Strategic Mode (Defense/Economy weighting)
Simulation Mode (flow visualization)
6.5 Simulation Layer

This is what makes it “FlightCN-like but deeper”.

Systems:
1. Traffic Flow Simulation
routes have “load”
congestion increases cost
rerouting behavior
2. Economic Flow
trade volume moves along shipping/rail/road
weighted by:
GDP
distance
political relationships
3. Military Logistics (Defense integration)
supply lines
front-line connectivity
route disruption modeling
4. Political Influence Flow (Diplomacy integration)
embassy networks
alliance route bias
embargo penalties
7. Data Model
RouteNode
{
  id: string
  type: "city" | "port" | "station" | "junction"
  coordinates: [number, number]
  countryId: string
  capacity?: number
}
RouteEdge
{
  id: string
  from: string
  to: string
  type: "road" | "rail" | "sea" | "airflow"
  cost: {
    time: number
    distance: number
    risk: number
    economic: number
  }
  capacity: number
  ownerCountryId: string
}
8. API Integration (tRPC)

New endpoints:

Routing
getRoute
getMultiModalRoute
simulateRouteFlow
Graph Management
createRouteEdge
updateRouteEdge
deleteRouteEdge
Simulation
getRouteTraffic
getEconomicFlowGraph
getStrategicRouteMap
9. Caching Strategy

Reuse your IxMaps architecture:

React Query (30 min stale)
IndexedDB (24h route cache)
Server-side caching:
rail routes: long TTL
political routes: short TTL
economic flows: dynamic TTL
10. Performance Considerations
Required Optimizations:
spatial indexing (R-tree or PostGIS)
route simplification (Douglas-Peucker — already in your stack)
precomputed hub graphs
lazy loading per zoom level
11. UX / UI Behavior
Route Visualization Layers Toggle:
Rail
Roads
Shipping
Economic Flow
Military Flow
Political Influence
Interaction:
hover route → cost breakdown panel
click route → RouteInfoPanel (you already have this)
click node → hub expansion graph
12. Differentiation (Why this is not just “routing”)

Most routing systems:

compute path → done

IxRoutes:

computes path
simulates flow
visualizes dynamics
integrates geopolitics + economy + warfare
supports procedural world generation feedback loops

This makes it closer to:

“FlightCN + Cities Skylines transport layer + geopolitical simulation engine”

13. MVP Scope
Phase 1 (Core)
road + rail routing (Valhalla/GraphHopper style)
MapLibre visualization
basic route editor tool (T tool extension)
RouteInfoPanel integration
Phase 2
shipping lanes
deck.gl animated flows
economic weighting
Phase 3
defense + diplomacy integration
congestion simulation
AI route generation
14. Risks
Graph complexity scaling (mitigated via zoom buckets + caching)
Simulation cost explosion (solve via sampling + aggregation)
UI clutter in multi-layer visualization (layer gating required)
15. Future Extensions
Real-time “world event disruptions” (wars, storms, embargoes)
Autonomous trade AI agents
Player-controlled logistics companies
Procedural rail empires
Dynamic “route wars” (competing infrastructure control)