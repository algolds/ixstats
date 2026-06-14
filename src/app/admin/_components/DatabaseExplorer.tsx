// src/app/admin/_components/DatabaseExplorer.tsx
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import {
  Database,
  Table,
  Search,
  Download,
  Edit3,
  Eye,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface DatabaseTable {
  name: string;
  rowCount: number;
  columns: TableColumn[];
  indexes: string[];
  foreignKeys: ForeignKey[];
  primaryKey: string[];
  lastModified: Date;
  diskSize: string;
}

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  executionTime: number;
  affectedRows?: number;
  message?: string;
}

export function DatabaseExplorer() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM countries LIMIT 10;");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Mock database tables
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [tables, setTables] = useState<DatabaseTable[]>([
    {
      name: "Country",
      rowCount: 195,
      columns: [
        { name: "id", type: "String", nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: "name", type: "String", nullable: false, isPrimaryKey: false, isForeignKey: false },
        {
          name: "population",
          type: "Int",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "gdpPerCapita",
          type: "Float",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "currentTotalGdp",
          type: "Float",
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "flagUrl",
          type: "String",
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "createdAt",
          type: "DateTime",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "updatedAt",
          type: "DateTime",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      indexes: ["name", "population", "gdpPerCapita"],
      foreignKeys: [],
      primaryKey: ["id"],
      lastModified: new Date(),
      diskSize: "2.4 MB",
    },
    {
      name: "User",
      rowCount: 47,
      columns: [
        { name: "id", type: "String", nullable: false, isPrimaryKey: true, isForeignKey: false },
        {
          name: "email",
          type: "String",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "username",
          type: "String",
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "countryId",
          type: "String",
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: true,
        },
        { name: "role", type: "Role", nullable: false, isPrimaryKey: false, isForeignKey: false },
        {
          name: "createdAt",
          type: "DateTime",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      indexes: ["email", "username", "countryId"],
      foreignKeys: [
        { columnName: "countryId", referencedTable: "Country", referencedColumn: "id" },
      ],
      primaryKey: ["id"],
      lastModified: new Date(Date.now() - 3600000),
      diskSize: "156 KB",
    },
    {
      name: "StorytellerEffect",
      rowCount: 23,
      columns: [
        { name: "id", type: "String", nullable: false, isPrimaryKey: true, isForeignKey: false },
        {
          name: "countryId",
          type: "String",
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: true,
        },
        {
          name: "inputType",
          type: "String",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        { name: "value", type: "Float", nullable: false, isPrimaryKey: false, isForeignKey: false },
        {
          name: "description",
          type: "String",
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "duration",
          type: "Float",
          nullable: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "isActive",
          type: "Boolean",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "ixTimeTimestamp",
          type: "DateTime",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      indexes: ["countryId", "inputType", "isActive"],
      foreignKeys: [
        { columnName: "countryId", referencedTable: "Country", referencedColumn: "id" },
      ],
      primaryKey: ["id"],
      lastModified: new Date(Date.now() - 7200000),
      diskSize: "45 KB",
    },
    {
      name: "GovernmentComponent",
      rowCount: 156,
      columns: [
        { name: "id", type: "String", nullable: false, isPrimaryKey: true, isForeignKey: false },
        {
          name: "countryId",
          type: "String",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: true,
        },
        {
          name: "componentType",
          type: "ComponentType",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "effectivenessScore",
          type: "Float",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "isActive",
          type: "Boolean",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
        {
          name: "implementationDate",
          type: "DateTime",
          nullable: false,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      indexes: ["countryId", "componentType", "isActive"],
      foreignKeys: [
        { columnName: "countryId", referencedTable: "Country", referencedColumn: "id" },
      ],
      primaryKey: ["id"],
      lastModified: new Date(Date.now() - 10800000),
      diskSize: "78 KB",
    },
  ]);

  // Fetch real data from API for query execution
  // eslint-disable-next-line unused-imports/no-unused-vars
  const { data: countriesData } = api.countries.getAll.useQuery(undefined, {
    enabled: false, // Only fetch when needed
  });

  const { refetch: fetchCountries } = api.countries.getAll.useQuery(undefined, {
    enabled: false,
  });

  const executeQuery = async () => {
    setIsExecuting(true);
    setQueryError(null);

    try {
      const startTime = Date.now();

      // Parse the query to determine what data to fetch
      const queryLower = sqlQuery.toLowerCase();

      if (queryLower.includes("select") && queryLower.includes("country")) {
        // Fetch real country data
        const result = await fetchCountries();

        if (result.data && "countries" in result.data) {
          const countries = result.data.countries;
          const queryResult: QueryResult = {
            columns: [
              "id",
              "name",
              "population",
              "gdpPerCapita",
              "economicTier",
              "diplomaticStanding",
            ],
            rows: countries
              .slice(0, 10)
              .map((country: any) => [
                country.id,
                country.name,
                country.currentPopulation,
                country.currentGdpPerCapita,
                country.economicTier,
                country.diplomaticStanding,
              ]),
            executionTime: Date.now() - startTime,
          };
          setQueryResult(queryResult);
        }
      } else if (queryLower.includes("select")) {
        // For other SELECT queries, return schema information
        const queryResult: QueryResult = {
          columns: ["table_name", "column_name", "data_type", "is_nullable"],
          rows: [
            ["Country", "id", "String", "NO"],
            ["Country", "name", "String", "NO"],
            ["Country", "currentPopulation", "BigInt", "NO"],
            ["Country", "currentGdpPerCapita", "Float", "NO"],
            ["User", "id", "String", "NO"],
            ["User", "clerkUserId", "String", "YES"],
            ["User", "email", "String", "YES"],
          ],
          executionTime: Date.now() - startTime,
        };
        setQueryResult(queryResult);
      } else {
        // For non-SELECT queries (INSERT, UPDATE, DELETE)
        const queryResult: QueryResult = {
          columns: [],
          rows: [],
          executionTime: Date.now() - startTime,
          affectedRows: 0,
          message: "Read-only mode: Write operations are disabled in this interface",
        };
        setQueryResult(queryResult);
      }
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : "Query execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const filteredTables = tables.filter((table) =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTableData = selectedTable ? tables.find((t) => t.name === selectedTable) : null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case "String":
        return "text-blue-600 dark:text-blue-400";
      case "Int":
        return "text-green-600 dark:text-green-400";
      case "Float":
        return "text-purple-600 dark:text-purple-400";
      case "Boolean":
        return "text-orange-600 dark:text-orange-400";
      case "DateTime":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Database Explorer</h2>
          <p className="text-muted-foreground">Explore database structure and execute queries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Schema
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tables List */}
        <div className="lg:col-span-1">
          <Card className="glass-surface border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Database className="h-4 w-4 text-indigo-500" />
                Database Tables
              </CardTitle>
              <div className="relative mt-2">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search tables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border/30 bg-card/10 focus:border-primary/50 focus:ring-primary/20 pl-10 focus:ring-1"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {filteredTables.map((table) => (
                  <div
                    key={table.name}
                    onClick={() => setSelectedTable(table.name)}
                    className={`cursor-pointer rounded-lg border p-3 transition-all duration-200 ${
                      selectedTable === table.name
                        ? "bg-primary/10 border-primary/40 shadow-sm"
                        : "border-border/20 bg-card/5 hover:bg-card/15 hover:border-border/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-sm font-medium">{table.name}</span>
                      </div>
                      <Badge variant="outline" className="border-border/30 bg-card/30 text-[10px]">
                        {table.rowCount.toLocaleString()}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 text-[11px]">
                      {table.columns.length} columns • {table.diskSize}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table Details & Query Interface */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="structure" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <TabsTrigger value="structure">Structure</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="query">SQL Query</TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="space-y-4 outline-none">
              {selectedTableData ? (
                <Card className="glass-surface border-border/40">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">
                      {selectedTableData.name} Table Structure
                    </CardTitle>
                    <div className="text-muted-foreground flex gap-4 text-xs font-medium">
                      <span>{selectedTableData.rowCount.toLocaleString()} rows</span>
                      <span>{selectedTableData.columns.length} columns</span>
                      <span>{selectedTableData.diskSize}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
                        Columns
                      </h4>
                      <div className="space-y-2">
                        {selectedTableData.columns.map((column) => (
                          <div
                            key={column.name}
                            className="bg-card/10 border-border/20 flex items-center justify-between rounded-lg border p-2.5"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-semibold">{column.name}</span>
                              <span className={`font-mono text-xs ${getTypeColor(column.type)}`}>
                                {column.type}
                              </span>
                              {column.isPrimaryKey && (
                                <Badge
                                  variant="outline"
                                  className="border-primary/20 bg-primary/5 text-primary text-[10px]"
                                >
                                  PK
                                </Badge>
                              )}
                              {column.isForeignKey && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/20 bg-amber-500/5 text-[10px] text-amber-500"
                                >
                                  FK
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!column.nullable && (
                                <Badge variant="secondary" className="bg-secondary/30 text-[10px]">
                                  NOT NULL
                                </Badge>
                              )}
                              {column.defaultValue && (
                                <span className="text-muted-foreground font-mono text-xs">
                                  Default: {column.defaultValue}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedTableData.foreignKeys.length > 0 && (
                      <div>
                        <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
                          Foreign Keys
                        </h4>
                        <div className="space-y-2">
                          {selectedTableData.foreignKeys.map((fk, index) => (
                            <div
                              key={index}
                              className="bg-card/10 border-border/20 flex items-center gap-2 rounded border p-2.5 font-mono text-sm"
                            >
                              <span className="font-semibold text-amber-500">{fk.columnName}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>
                                {fk.referencedTable}.{fk.referencedColumn}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
                        Indexes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTableData.indexes.map((index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="border-border/30 bg-card/20 font-mono text-xs"
                          >
                            {index}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-surface border-border/40">
                  <CardContent className="flex h-64 items-center justify-center">
                    <div className="text-center">
                      <Table className="text-muted-foreground mx-auto mb-2 h-12 w-12" />
                      <p className="text-muted-foreground">Select a table to view its structure</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="data" className="space-y-4 outline-none">
              <Card className="glass-surface border-border/40">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Table Data</CardTitle>
                  <p className="text-muted-foreground text-xs">
                    Browse and filter table data with pagination
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Table selection and controls */}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select
                      value={selectedTable || ""}
                      onValueChange={(value) => setSelectedTable(value || null)}
                    >
                      <SelectTrigger className="border-border/30 bg-card/10 flex-1">
                        <SelectValue placeholder="Select a table to browse" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((table) => (
                          <SelectItem key={table.name} value={table.name}>
                            {table.name} ({table.rowCount.toLocaleString()} rows)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Filter records..."
                      className="border-border/30 bg-card/10 flex-1 sm:max-w-xs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Button variant="outline" size="sm" className="border-border/30">
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </Button>
                  </div>

                  {selectedTable && selectedTableData && (
                    <div className="border-border/30 bg-card/5 overflow-hidden rounded-lg border shadow-inner">
                      {/* Table header */}
                      <div className="border-border/20 bg-card/10 border-b p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Table: {selectedTable}</h4>
                          <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span>
                              Showing 1-10 of {selectedTableData.rowCount.toLocaleString()} records
                            </span>
                            <Button variant="ghost" size="sm" className="hover:bg-card/10 h-7">
                              <Download className="mr-1 h-3.5 w-3.5" />
                              Export
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Table content */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-card/20 border-border/25 border-b">
                            <tr>
                              {selectedTableData.columns.slice(0, 6).map((column) => (
                                <th
                                  key={column.name}
                                  className="text-muted-foreground p-3 text-left text-xs font-semibold tracking-wider uppercase"
                                >
                                  {column.name}
                                  {column.isPrimaryKey && (
                                    <Badge
                                      variant="outline"
                                      className="border-primary/20 bg-primary/5 text-primary ml-1 text-[9px]"
                                    >
                                      PK
                                    </Badge>
                                  )}
                                  {column.isForeignKey && (
                                    <Badge
                                      variant="secondary"
                                      className="bg-secondary/30 ml-1 text-[9px]"
                                    >
                                      FK
                                    </Badge>
                                  )}
                                </th>
                              ))}
                              <th className="text-muted-foreground p-3 text-left text-xs font-semibold tracking-wider uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                              <tr key={i} className="hover:bg-card/10 border-border/10 border-b">
                                {selectedTableData.columns.slice(0, 6).map((column) => (
                                  <td key={column.name} className="p-3 text-sm">
                                    {column.name === "id" ? (
                                      <span className="font-mono text-xs">
                                        {selectedTable}_{i}
                                      </span>
                                    ) : column.type.toLowerCase().includes("boolean") ? (
                                      <div
                                        className={`h-2 w-2 rounded-full ${Math.random() > 0.5 ? "bg-green-500" : "bg-gray-400"}`}
                                      ></div>
                                    ) : column.type.toLowerCase().includes("date") ? (
                                      <span className="text-muted-foreground">
                                        2025-01-{String(i).padStart(2, "0")}
                                      </span>
                                    ) : column.type.toLowerCase().includes("number") ||
                                      column.type.toLowerCase().includes("int") ? (
                                      <span className="font-medium">
                                        {(Math.random() * 10000).toFixed(0)}
                                      </span>
                                    ) : (
                                      <span>
                                        Sample {column.name} {i}
                                      </span>
                                    )}
                                  </td>
                                ))}
                                <td className="p-3">
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm">
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="border-border/25 bg-card/10 flex items-center justify-between border-t p-4">
                        <div className="text-muted-foreground text-xs">
                          Page 1 of {Math.ceil(selectedTableData.rowCount / 10)}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" disabled className="h-8 text-xs">
                            Previous
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedTable && (
                    <div className="text-muted-foreground bg-card/5 border-border/30 rounded-lg border border-dashed py-12 text-center">
                      <Database className="text-muted-foreground/60 mx-auto mb-3 h-10 w-10" />
                      <p className="text-sm">Select a table above to browse its data</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="query" className="space-y-4 outline-none">
              <Card className="glass-surface border-border/40">
                <CardHeader>
                  <CardTitle className="text-base font-bold">SQL Query Console</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Execute custom SQL queries (SELECT only for security)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="border-border/30 bg-card/10 hover:border-border/40 focus:border-primary/50 focus:ring-primary/20 text-foreground h-32 w-full resize-none rounded-lg border p-3 font-mono text-sm transition-all outline-none focus:ring-1"
                      placeholder="Enter your SQL query..."
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Only SELECT queries are allowed for security
                    </div>
                    <Button
                      onClick={executeQuery}
                      disabled={isExecuting || !sqlQuery.trim()}
                      className="flex items-center gap-2"
                    >
                      {isExecuting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Execute Query
                    </Button>
                  </div>

                  {queryError && (
                    <Alert className="border-destructive/30 bg-destructive/10 text-destructive-foreground">
                      <AlertTriangle className="text-destructive h-4 w-4" />
                      <AlertDescription>{queryError}</AlertDescription>
                    </Alert>
                  )}

                  {queryResult && (
                    <Card className="glass-surface border-border/30">
                      <CardHeader className="py-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-bold">Query Results</CardTitle>
                          <div className="text-muted-foreground flex items-center gap-4 text-xs font-medium">
                            <span>Execution time: {queryResult.executionTime.toFixed(2)}ms</span>
                            {queryResult.affectedRows !== undefined && (
                              <span>{queryResult.affectedRows} rows affected</span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        {queryResult.rows.length > 0 ? (
                          <div className="border-border/20 overflow-x-auto rounded-lg border">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-card/20 border-border/20 border-b">
                                  {queryResult.columns.map((column) => (
                                    <th
                                      key={column}
                                      className="border-border/20 text-muted-foreground border-r px-3 py-2 text-left text-xs font-medium uppercase last:border-r-0"
                                    >
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {queryResult.rows.map((row, index) => (
                                  <tr
                                    key={index}
                                    className="hover:bg-card/10 border-border/10 border-b last:border-b-0"
                                  >
                                    {row.map((cell, cellIndex) => (
                                      <td
                                        key={cellIndex}
                                        className="border-border/20 text-foreground border-r px-3 py-2 font-mono text-xs last:border-r-0"
                                      >
                                        {cell?.toString() || "NULL"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-muted-foreground py-6 text-center text-xs font-semibold">
                            Query executed successfully
                            {queryResult.affectedRows !== undefined &&
                              ` - ${queryResult.affectedRows} rows affected`}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
