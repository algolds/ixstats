// src/app/admin/_components/DatabaseExplorer.tsx
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Database,
  Table,
  Search,
  Filter,
  Download,
  Edit3,
  Trash2,
  Plus,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  BarChart3,
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
import { Separator } from "~/components/ui/separator";

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
      name: "DmInput",
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Tables
              </CardTitle>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search tables..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredTables.map((table) => (
                  <div
                    key={table.name}
                    onClick={() => setSelectedTable(table.name)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selectedTable === table.name
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Table className="h-4 w-4" />
                        <span className="font-medium">{table.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {table.rowCount.toLocaleString()}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
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

            <TabsContent value="structure" className="space-y-4">
              {selectedTableData ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedTableData.name} Table Structure</CardTitle>
                    <div className="text-muted-foreground flex gap-4 text-sm">
                      <span>{selectedTableData.rowCount.toLocaleString()} rows</span>
                      <span>{selectedTableData.columns.length} columns</span>
                      <span>{selectedTableData.diskSize}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="mb-3 font-medium">Columns</h4>
                      <div className="space-y-2">
                        {selectedTableData.columns.map((column) => (
                          <div
                            key={column.name}
                            className="bg-muted flex items-center justify-between rounded p-2"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-medium">{column.name}</span>
                              <span className={`text-sm ${getTypeColor(column.type)}`}>
                                {column.type}
                              </span>
                              {column.isPrimaryKey && (
                                <Badge variant="outline" className="text-xs">
                                  PK
                                </Badge>
                              )}
                              {column.isForeignKey && (
                                <Badge variant="outline" className="text-xs">
                                  FK
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!column.nullable && (
                                <Badge variant="secondary" className="text-xs">
                                  NOT NULL
                                </Badge>
                              )}
                              {column.defaultValue && (
                                <span className="text-muted-foreground text-xs">
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
                        <h4 className="mb-3 font-medium">Foreign Keys</h4>
                        <div className="space-y-2">
                          {selectedTableData.foreignKeys.map((fk, index) => (
                            <div key={index} className="bg-muted rounded p-2 text-sm">
                              <span className="font-mono">{fk.columnName}</span>
                              <span className="text-muted-foreground"> → </span>
                              <span className="font-mono">
                                {fk.referencedTable}.{fk.referencedColumn}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="mb-3 font-medium">Indexes</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTableData.indexes.map((index) => (
                          <Badge key={index} variant="outline" className="font-mono">
                            {index}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex h-64 items-center justify-center">
                    <div className="text-center">
                      <Table className="text-muted-foreground mx-auto mb-2 h-12 w-12" />
                      <p className="text-muted-foreground">Select a table to view its structure</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="data" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Table Data</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Browse and filter table data with pagination
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Table selection and controls */}
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Select
                        value={selectedTable || ""}
                        onValueChange={(value) => setSelectedTable(value || null)}
                      >
                        <SelectTrigger className="flex-1">
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
                        className="flex-1 sm:max-w-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <Button variant="outline" size="sm">
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </Button>
                    </div>

                    {selectedTable && selectedTableData && (
                      <div className="glass-card-child rounded-lg border">
                        {/* Table header */}
                        <div className="border-b p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">Table: {selectedTable}</h4>
                            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                              <span>
                                Showing 1-10 of {selectedTableData.rowCount.toLocaleString()}{" "}
                                records
                              </span>
                              <Button variant="ghost" size="sm">
                                <Download className="mr-1 h-4 w-4" />
                                Export
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Table content */}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/30 border-b">
                              <tr>
                                {selectedTableData.columns.slice(0, 6).map((column) => (
                                  <th key={column.name} className="p-3 text-left font-medium">
                                    {column.name}
                                    {column.isPrimaryKey && (
                                      <Badge variant="outline" className="ml-1 text-xs">
                                        PK
                                      </Badge>
                                    )}
                                    {column.isForeignKey && (
                                      <Badge variant="secondary" className="ml-1 text-xs">
                                        FK
                                      </Badge>
                                    )}
                                  </th>
                                ))}
                                <th className="p-3 text-left font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                                <tr key={i} className="hover:bg-muted/20 border-b">
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
                        <div className="flex items-center justify-between border-t p-4">
                          <div className="text-muted-foreground text-sm">
                            Page 1 of {Math.ceil(selectedTableData.rowCount / 10)}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled>
                              Previous
                            </Button>
                            <Button variant="outline" size="sm">
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!selectedTable && (
                      <div className="text-muted-foreground py-8 text-center">
                        <Database className="mx-auto mb-3 h-12 w-12 opacity-50" />
                        <p>Select a table above to browse its data</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="query" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>SQL Query Console</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    Execute custom SQL queries (SELECT only for security)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="h-32 w-full resize-none rounded-md border p-3 font-mono text-sm"
                      placeholder="Enter your SQL query..."
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4" />
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
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{queryError}</AlertDescription>
                    </Alert>
                  )}

                  {queryResult && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Query Results</CardTitle>
                          <div className="text-muted-foreground flex items-center gap-4 text-sm">
                            <span>Execution time: {queryResult.executionTime.toFixed(2)}ms</span>
                            {queryResult.affectedRows !== undefined && (
                              <span>{queryResult.affectedRows} rows affected</span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {queryResult.rows.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="border-border w-full border-collapse border">
                              <thead>
                                <tr className="bg-muted">
                                  {queryResult.columns.map((column) => (
                                    <th
                                      key={column}
                                      className="border-border border px-3 py-2 text-left font-medium"
                                    >
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {queryResult.rows.map((row, index) => (
                                  <tr key={index} className="hover:bg-muted/50">
                                    {row.map((cell, cellIndex) => (
                                      <td
                                        key={cellIndex}
                                        className="border-border border px-3 py-2 font-mono text-sm"
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
                          <div className="text-muted-foreground py-4 text-center">
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
