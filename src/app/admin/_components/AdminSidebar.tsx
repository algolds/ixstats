// src/app/admin/_components/AdminSidebar.tsx
// Admin panel navigation sidebar

import { Shield, Settings, Monitor, Code, Gamepad2, Clock, Bot, Upload, BarChart3, Users, Bell, List, TrendingUp } from "lucide-react";
import { Users as UsersIcon } from "lucide-react";

interface AdminSidebarProps {
  selectedSection: string;
  onSectionChange: (section: string) => void;
}

export function AdminSidebar({ selectedSection, onSectionChange }: AdminSidebarProps) {
  return (
    <div className="w-72 min-h-screen bg-card/50 backdrop-blur-sm border-r border-border/50 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Console</h1>
            <p className="text-sm text-muted-foreground">System Management</p>
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
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
            <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Core Functions
            </h3>
            <div className="space-y-1">
              {[
                { value: "system", icon: <Monitor className="h-5 w-5" />, label: "System Monitor" },
                { value: "formulas", icon: <Code className="h-5 w-5" />, label: "Formula Editor" },
                { value: "storyteller", icon: <Gamepad2 className="h-5 w-5" />, label: "Storyteller (God Mode)" },
                { value: "time", icon: <Clock className="h-5 w-5" />, label: "Time Controls" },
                { value: "navigation", icon: <Settings className="h-5 w-5" />, label: "Navigation Settings" }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border border-primary/20"
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
            <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Data & Integration
            </h3>
            <div className="space-y-1">
              {[
                { value: "bot", icon: <Bot className="h-5 w-5" />, label: "Discord Bot" },
                { value: "import", icon: <Upload className="h-5 w-5" />, label: "Data Import" },
                { value: "ixtime-visualizer", icon: <BarChart3 className="h-5 w-5" />, label: "IxTime Visualizer" }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border border-primary/20"
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
            <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              User Management
            </h3>
            <div className="space-y-1">
              {[
                { value: "user-management", icon: <Users className="h-5 w-5" />, label: "Users & Roles" },
                { value: "country-admin", icon: <UsersIcon className="h-5 w-5" />, label: "Country Admin" },
                { value: "notifications", icon: <Bell className="h-5 w-5" />, label: "Notifications" }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Monitoring */}
          <div>
            <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Monitoring
            </h3>
            <div className="space-y-1">
              {[
                { value: "logs", icon: <List className="h-5 w-5" />, label: "System Logs" },
                { value: "economic", icon: <TrendingUp className="h-5 w-5" />, label: "Economic Monitor" }
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onSectionChange(item.value)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    selectedSection === item.value
                      ? "bg-primary/10 text-primary border border-primary/20"
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
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>System Online</span>
        </div>
      </div>
    </div>
  );
}
