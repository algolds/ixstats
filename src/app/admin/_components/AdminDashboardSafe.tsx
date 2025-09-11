// src/app/admin/_components/AdminDashboardSafe.tsx
"use client";

import { useState } from "react";
import { 
  Monitor, 
  Database, 
  Settings, 
  Users, 
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export function AdminDashboardSafe() {
  const [activeTab, setActiveTab] = useState("overview");

  const mockStats = {
    totalCountries: 195,
    activeUsers: 47,
    systemHealth: 98.5,
    apiCalls: 12847,
    databaseQueries: 5621,
    errors: 3
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">System monitoring and administration</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            System Online
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System Monitor</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Countries</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.totalCountries}</div>
                <p className="text-xs text-muted-foreground">
                  Active in simulation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.activeUsers}</div>
                <p className="text-xs text-muted-foreground">
                  Currently registered
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {mockStats.systemHealth}%
                </div>
                <p className="text-xs text-muted-foreground">
                  All systems operational
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.apiCalls.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Last 24 hours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database Queries</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.databaseQueries.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Average response: 23ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{mockStats.errors}</div>
                <p className="text-xs text-muted-foreground">
                  Last hour (low priority)
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">User authentication successful</span>
                  <Badge variant="outline">2 min ago</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Economic calculations updated</span>
                  <Badge variant="outline">5 min ago</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database backup completed</span>
                  <Badge variant="outline">15 min ago</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bot sync successful</span>
                  <Badge variant="outline">22 min ago</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Monitor</CardTitle>
              <p className="text-sm text-muted-foreground">
                Real-time system performance metrics
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>CPU Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted h-2 rounded">
                      <div className="w-1/3 bg-green-500 h-2 rounded"></div>
                    </div>
                    <span className="text-sm">32%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Memory Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted h-2 rounded">
                      <div className="w-2/3 bg-yellow-500 h-2 rounded"></div>
                    </div>
                    <span className="text-sm">67%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Disk Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted h-2 rounded">
                      <div className="w-1/2 bg-blue-500 h-2 rounded"></div>
                    </div>
                    <span className="text-sm">45%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage user accounts and permissions
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* User Role Management */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg">Active Users</h4>
                    <div className="space-y-2">
                      {[
                        { name: "Admin User", role: "admin", country: "United States", status: "online" },
                        { name: "DM User", role: "dm", country: "United Kingdom", status: "offline" },
                        { name: "Player 1", role: "user", country: "Germany", status: "online" },
                        { name: "Player 2", role: "user", country: "France", status: "online" },
                      ].map((user, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <div>
                              <p className="font-medium text-sm">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.country}</p>
                            </div>
                          </div>
                          <Badge variant={user.role === 'admin' ? 'default' : user.role === 'dm' ? 'secondary' : 'outline'}>
                            {user.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" size="sm" className="flex flex-col h-auto py-4">
                        <Users className="h-5 w-5 mb-2" />
                        <span className="text-xs">Assign Countries</span>
                      </Button>
                      <Button variant="outline" size="sm" className="flex flex-col h-auto py-4">
                        <Shield className="h-5 w-5 mb-2" />
                        <span className="text-xs">Manage Roles</span>
                      </Button>
                      <Button variant="outline" size="sm" className="flex flex-col h-auto py-4">
                        <Activity className="h-5 w-5 mb-2" />
                        <span className="text-xs">View Activity</span>
                      </Button>
                      <Button variant="outline" size="sm" className="flex flex-col h-auto py-4">
                        <Settings className="h-5 w-5 mb-2" />
                        <span className="text-xs">User Settings</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* System Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Users</span>
                    </div>
                    <div className="text-2xl font-bold">47</div>
                    <div className="text-xs text-muted-foreground">+3 this week</div>
                  </div>
                  <div className="p-4 rounded-lg border bg-green-500/5 border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Active Now</span>
                    </div>
                    <div className="text-2xl font-bold">12</div>
                    <div className="text-xs text-muted-foreground">Last 5 minutes</div>
                  </div>
                  <div className="p-4 rounded-lg border bg-purple-500/5 border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Admins</span>
                    </div>
                    <div className="text-2xl font-bold">3</div>
                    <div className="text-xs text-muted-foreground">System administrators</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure system parameters and preferences
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Debug Mode</p>
                    <p className="text-sm text-muted-foreground">Enable detailed logging</p>
                  </div>
                  <Button variant="outline" size="sm">
                    {process.env.NODE_ENV === 'development' ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Backup</p>
                    <p className="text-sm text-muted-foreground">Automatic database backups</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Enabled
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">API Rate Limiting</p>
                    <p className="text-sm text-muted-foreground">Limit requests per minute</p>
                  </div>
                  <Button variant="outline" size="sm">
                    100/min
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}