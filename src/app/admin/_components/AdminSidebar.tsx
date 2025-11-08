// src/app/admin/_components/AdminSidebar.tsx
// Admin panel navigation sidebar

import {
  Shield,
  Settings,
  Monitor,
  Code,
  Gamepad2,
  Clock,
  Bot,
  Upload,
  BarChart3,
  Users,
  Bell,
  List,
  TrendingUp,
  Flag,
  Rocket,
  Factory,
  Drama,
  UserCog,
  MapPin,
  Activity,
} from "lucide-react";
import { Users as UsersIcon } from "lucide-react";
import { withBasePath } from "@/lib/base-path";

interface AdminSidebarProps {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminSidebar({ selectedSection, onSectionChange }: AdminSidebarProps) {
  return (
    <div className="bg-card/50 border-border/50 flex min-h-screen w-72 flex-col border-r backdrop-blur-sm">
      {/* Header */}
      <div className="border-border/50 border-b p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 border-primary/20 rounded-xl border p-2">
            <Shield className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="text-foreground text-xl font-bold">Admin Console</h1>
            <p className="text-muted-foreground text-sm">System Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <nav className="space-y-6">
          {/* Overview */}
          <div>
            <button
              onClick={() => onSectionChange("overview")}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                selectedSection === "overview"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="h-5 w-5" />
              <span className="font-medium">Dashboard</span>
            </button>
          </div>

          {/* Main Functions */}
          <div>
            <h3 className="text-muted-foreground mb-3 px-4 text-xs font-semibold tracking-wider uppercase">
              Core Functions
            </h3>
            <div className="space-y-1">
              {[
                { value: "system", icon: <Monitor className="h-5 w-5" />, label: "System Monitor" },
                { value: "formulas", icon: <Code className="h-5 w-5" />, label: "Formula Editor" },
                {
                  value: "storyteller",
                  icon: <Gamepad2 className="h-5 w-5" />,
                  label: "Storyteller (God Mode)",
                },
                { value: "time", icon: <Clock className="h-5 w-5" />, label: "Time Controls" },
                {
                  value: "navigation",
                  icon: <Settings className="h-5 w-5" />,
                  label: "Navigation Settings",
                },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border-primary/20 border"
                      : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data & Integration */}
          <div>
            <h3 className="text-muted-foreground mb-3 px-4 text-xs font-semibold tracking-wider uppercase">
              Data & Integration
            </h3>
            <div className="space-y-1">
              {[
                { value: "bot", icon: <Bot className="h-5 w-5" />, label: "Discord Bot" },
                { value: "import", icon: <Upload className="h-5 w-5" />, label: "Data Import" },
                {
                  value: "ixtime-visualizer",
                  icon: <BarChart3 className="h-5 w-5" />,
                  label: "IxTime Visualizer",
                },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border-primary/20 border"
                      : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User Management */}
          <div>
            <h3 className="text-muted-foreground mb-3 px-4 text-xs font-semibold tracking-wider uppercase">
              User Management
            </h3>
            <div className="space-y-1">
              {[
                {
                  value: "user-management",
                  icon: <Users className="h-5 w-5" />,
                  label: "Users & Roles",
                },
                {
                  value: "country-admin",
                  icon: <UsersIcon className="h-5 w-5" />,
                  label: "Country Admin",
                },
                {
                  value: "notifications",
                  icon: <Bell className="h-5 w-5" />,
                  label: "Notifications",
                },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border-primary/20 border"
                      : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference Data */}
          <div>
            <h3 className="text-muted-foreground mb-3 px-4 text-xs font-semibold tracking-wider uppercase">
              Reference Data
            </h3>
            <div className="space-y-1">
              <a
                href={withBasePath("/admin/map-editor")}
                className="hover:bg-muted/30 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200"
              >
                <MapPin className="h-5 w-5" />
                <span className="text-sm font-medium">Map Editor Review</span>
              </a>
              <a
                href={withBasePath("/admin/maps-monitoring")}
                className="hover:bg-muted/30 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200"
              >
                <Activity className="h-5 w-5" />
                <span className="text-sm font-medium">Maps Monitoring</span>
              </a>
              <a
                href={withBasePath("/admin/diplomatic-options")}
                className="hover:bg-muted/30 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200"
              >
                <Flag className="h-5 w-5" />
                <span className="text-sm font-medium">Diplomatic Options</span>
              </a>
              <a
                href={withBasePath("/admin/diplomatic-scenarios")}
                className="hover:bg-muted/30 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200"
              >
                <Drama className="h-5 w-5" />
                <span className="text-sm font-medium">Diplomatic Scenarios</span>
              </a>
              <a
                href={withBasePath("/admin/diplomatic-scenarios/analytics")}
                className="hover:bg-muted/30 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200"
              >
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium">Scenario Analytics</span>
              </a>
              <a
                href={withBasePath("/admin/military-equipment")}
                className="hover:bg-muted/30 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200"
              >
                <Rocket className="h-5 w-5" />
                <span className="text-sm font-medium">Military Equipment</span>
              </a>
              <a
                href={withBasePath("/admin/npc-personalities")}
                className="hover:bg-muted/30 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200"
              >
                <UserCog className="h-5 w-5" />
                <span className="text-sm font-medium">NPC Personalities</span>
              </a>
            </div>
          </div>

          {/* Monitoring */}
          <div>
            <h3 className="text-muted-foreground mb-3 px-4 text-xs font-semibold tracking-wider uppercase">
              Monitoring
            </h3>
            <div className="space-y-1">
              {[
                { value: "logs", icon: <List className="h-5 w-5" />, label: "System Logs" },
                {
                  value: "economic",
                  icon: <TrendingUp className="h-5 w-5" />,
                  label: "Economic Monitor",
                },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border-primary/20 border"
                      : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* Footer */}
      <div className="border-border/50 border-t p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span>System Online</span>
        </div>
      </div>
    </div>
  );
}
