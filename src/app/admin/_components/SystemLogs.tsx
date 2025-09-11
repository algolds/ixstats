// src/app/admin/_components/SystemLogs.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Terminal,
  Download,
  Filter,
  Search,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Server,
  Bot,
  Users,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";
import { formatDistanceToNow } from "date-fns";

interface SystemLog {
  id: string;
  timestamp: Date;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  category: "DATABASE" | "API" | "AUTH" | "BOT" | "CALCULATION" | "SYSTEM";
  message: string;
  details?: any;
  userId?: string;
  requestId?: string;
  duration?: number;
}

const LOG_LEVELS = {
  DEBUG: { color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800", icon: Terminal },
  INFO: { color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", icon: Info },
  WARN: { color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30", icon: AlertTriangle },
  ERROR: { color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", icon: XCircle },
  FATAL: { color: "text-red-800", bg: "bg-red-200 dark:bg-red-900/50", icon: XCircle }
};

const LOG_CATEGORIES = {
  DATABASE: { color: "text-purple-600", icon: Database },
  API: { color: "text-green-600", icon: Server },
  AUTH: { color: "text-indigo-600", icon: Users },
  BOT: { color: "text-orange-600", icon: Bot },
  CALCULATION: { color: "text-cyan-600", icon: Zap },
  SYSTEM: { color: "text-gray-600", icon: Terminal }
};

export function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRealTime, setIsRealTime] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Generate mock logs
  const generateMockLogs = (count: number = 50) => {
    const mockLogs: SystemLog[] = [];
    const messages = {
      DATABASE: [
        "Connection pool initialized with 10 connections",
        "Query execution completed",
        "Database migration applied successfully",
        "Connection timeout on query execution",
        "Index optimization completed",
        "Backup operation started"
      ],
      API: [
        "HTTP request processed successfully",
        "Rate limit exceeded for IP",
        "Authentication successful",
        "API endpoint deprecated warning",
        "Request validation failed",
        "Cache hit for resource"
      ],
      AUTH: [
        "User login successful",
        "Invalid authentication attempt",
        "Session expired",
        "Password reset requested",
        "Admin access granted",
        "JWT token validated"
      ],
      BOT: [
        "Discord bot connected successfully",
        "Command processing completed",
        "Bot health check passed",
        "Message rate limit applied",
        "Guild member update received",
        "Bot reconnection attempt"
      ],
      CALCULATION: [
        "GDP growth calculation completed",
        "Economic tier updated for country",
        "Tax efficiency recalculated",
        "Population growth processed",
        "DM input modifier applied",
        "Atomic component effectiveness updated"
      ],
      SYSTEM: [
        "System startup completed",
        "Memory usage optimization applied",
        "Cache cleared successfully",
        "Configuration reloaded",
        "Health check endpoint responded",
        "Scheduled task executed"
      ]
    };

    for (let i = 0; i < count; i++) {
      const categories = Object.keys(messages) as (keyof typeof messages)[];
      const category = categories[Math.floor(Math.random() * categories.length)]!;
      const levels: SystemLog["level"][] = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
      const level = levels[Math.floor(Math.random() * levels.length)]!;
      
      // Weight towards INFO and DEBUG, fewer errors
      const levelWeights = { DEBUG: 30, INFO: 50, WARN: 15, ERROR: 4, FATAL: 1 };
      const weightedLevel = Math.random() < 0.8 ? "INFO" : 
                          Math.random() < 0.9 ? "DEBUG" :
                          Math.random() < 0.95 ? "WARN" : 
                          Math.random() < 0.99 ? "ERROR" : "FATAL";

      mockLogs.push({
        id: `log-${i}`,
        timestamp: new Date(Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000)), // Last 7 days
        level: weightedLevel as SystemLog["level"],
        category,
        message: messages[category][Math.floor(Math.random() * messages[category].length)]!,
        userId: Math.random() > 0.7 ? `user-${Math.floor(Math.random() * 100)}` : undefined,
        requestId: Math.random() > 0.5 ? `req-${Math.random().toString(36).substring(7)}` : undefined,
        duration: Math.random() > 0.6 ? Math.random() * 1000 + 10 : undefined,
        details: Math.random() > 0.8 ? {
          additionalInfo: "Sample details object",
          errorCode: Math.random() > 0.5 ? "ERR_001" : undefined,
          stackTrace: weightedLevel === "ERROR" ? "Error: Sample stack trace..." : undefined
        } : undefined
      });
    }

    return mockLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  };

  // Initialize logs
  useEffect(() => {
    const initialLogs = generateMockLogs(100);
    setLogs(initialLogs);
  }, []);

  // Real-time log simulation
  useEffect(() => {
    if (!isRealTime) return;

    const interval = setInterval(() => {
      const newLog = generateMockLogs(1)[0];
      if (newLog) {
        newLog.timestamp = new Date();
        setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 999)]); // Keep last 1000 logs
      }
    }, 2000 + Math.random() * 3000); // Random interval 2-5 seconds

    return () => clearInterval(interval);
  }, [isRealTime]);

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedLevel !== "ALL") {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }

    if (selectedCategory !== "ALL") {
      filtered = filtered.filter(log => log.category === selectedCategory);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, selectedLevel, selectedCategory]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isRealTime) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredLogs, isRealTime]);

  const exportLogs = () => {
    const logData = filteredLogs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      category: log.category,
      message: log.message,
      userId: log.userId,
      requestId: log.requestId,
      duration: log.duration,
      details: log.details
    }));
    
    const dataStr = JSON.stringify(logData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `system-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearLogs = () => {
    if (confirm("Are you sure you want to clear all logs? This action cannot be undone.")) {
      setLogs([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Logs</h2>
          <p className="text-muted-foreground">Real-time system logs and error tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLogs} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={clearLogs} className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Clear
          </Button>
          <Button 
            variant={isRealTime ? "default" : "outline"}
            onClick={() => setIsRealTime(!isRealTime)}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRealTime ? 'animate-spin' : ''}`} />
            {isRealTime ? "Stop" : "Live"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                {Object.keys(LOG_LEVELS).map(level => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {Object.keys(LOG_CATEGORIES).map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {filteredLogs.length} logs
              </Badge>
              {isRealTime && (
                <Badge variant="default" className="animate-pulse">
                  LIVE
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            {filteredLogs.length > 0 ? (
              <div className="divide-y">
                {filteredLogs.map((log) => {
                  const levelConfig = LOG_LEVELS[log.level];
                  const categoryConfig = LOG_CATEGORIES[log.category];
                  const LevelIcon = levelConfig.icon;
                  const CategoryIcon = categoryConfig.icon;

                  return (
                    <div key={log.id} className={`p-4 hover:bg-muted/50 ${levelConfig.bg}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <LevelIcon className={`h-4 w-4 ${levelConfig.color} flex-shrink-0`} />
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {log.level}
                          </Badge>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CategoryIcon className={`h-4 w-4 ${categoryConfig.color}`} />
                            <span className="font-medium text-sm">{log.category}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                            </span>
                            {log.duration && (
                              <span className="text-xs text-muted-foreground">
                                ({log.duration.toFixed(0)}ms)
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-foreground mb-2">{log.message}</p>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{log.timestamp.toLocaleString()}</span>
                            {log.requestId && (
                              <span className="font-mono">req: {log.requestId}</span>
                            )}
                            {log.userId && (
                              <span className="font-mono">user: {log.userId}</span>
                            )}
                          </div>
                          
                          {log.details && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Show details
                              </summary>
                              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="text-center py-12">
                <Terminal className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No logs found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  No logs match your current filters
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}