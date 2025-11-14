import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Database,
  Zap,
  HardDrive,
  TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PerformanceData {
  tableSizes: Array<{
    table_name: string;
    total_size: string;
    table_size: string;
    indexes_size: string;
    row_count: number;
  }>;
  slowQueries: Array<{
    query: string;
    calls: number;
    total_time: number;
    mean_time: number;
    rows: number;
  }>;
  indexUsage: Array<{
    table_name: string;
    index_name: string;
    index_scans: number;
    rows_read: number;
    rows_fetched: number;
  }>;
  recommendations: string[];
  stats: {
    totalTables: number;
    totalSizeMB: number;
    slowQueryCount: number;
    unusedIndexCount: number;
  };
}

export function PerformanceMonitorTab() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: perfData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["database-performance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("analyze-performance");
      if (error) throw error;
      return data as PerformanceData;
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const formatBytes = (bytes: string | number) => {
    const num = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (num === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return Math.round((num / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getRecommendationIcon = (rec: string) => {
    if (rec.startsWith("📊")) return <TrendingUp className="h-4 w-4 text-info" />;
    if (rec.startsWith("📦")) return <HardDrive className="h-4 w-4 text-warning" />;
    if (rec.startsWith("⚡")) return <Zap className="h-4 w-4 text-warning" />;
    if (rec.startsWith("🐢")) return <AlertTriangle className="h-4 w-4 text-error" />;
    if (rec.startsWith("🗑️") || rec.startsWith("⚠️")) return <AlertTriangle className="h-4 w-4 text-warning" />;
    if (rec.startsWith("🧹") || rec.startsWith("📅") || rec.startsWith("💾")) return <Database className="h-4 w-4 text-info" />;
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Database Performance Monitor</h2>
          <p className="text-muted-foreground">
            Real-time analysis of query performance, table sizes, and optimization opportunities
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          size="sm"
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Analyzing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{perfData?.stats.totalSizeMB || 0} MB</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {perfData?.stats.totalTables || 0} tables
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{perfData?.stats.slowQueryCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Queries over 100ms
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unused Indexes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{perfData?.stats.unusedIndexCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Can be optimized
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {perfData ? Math.max(0, 100 - (perfData.recommendations.length * 5)) : 100}%
            </div>
            <Progress 
              value={perfData ? Math.max(0, 100 - (perfData.recommendations.length * 5)) : 100}
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="tables">
            <Database className="h-4 w-4 mr-2" />
            Table Sizes
          </TabsTrigger>
          <TabsTrigger value="queries">
            <Activity className="h-4 w-4 mr-2" />
            Slow Queries
          </TabsTrigger>
          <TabsTrigger value="indexes">
            <Zap className="h-4 w-4 mr-2" />
            Index Usage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>
                Automated suggestions to improve database performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {perfData?.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      {getRecommendationIcon(rec)}
                      <span className="text-sm flex-1">
                        {rec.replace(/^[📊📦⚡🐢🗑️⚠️🧹📅💾✅]\s*/, '')}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle>Table Sizes</CardTitle>
              <CardDescription>
                Storage usage and row counts for all tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                      <TableHead className="text-right">Table Size</TableHead>
                      <TableHead className="text-right">Index Size</TableHead>
                      <TableHead className="text-right">Total Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perfData?.tableSizes.map((table) => (
                      <TableRow key={table.table_name}>
                        <TableCell className="font-medium">{table.table_name}</TableCell>
                        <TableCell className="text-right">
                          {(typeof table.row_count === 'number' ? table.row_count : parseInt(table.row_count || '0')).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBytes(table.table_size)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBytes(table.indexes_size)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBytes(table.total_size)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries">
          <Card>
            <CardHeader>
              <CardTitle>Slow Queries</CardTitle>
              <CardDescription>
                Most time-consuming database queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {perfData?.slowQueries.length === 0 ? (
                    <div className="flex items-center gap-2 text-success p-4 border rounded-lg">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>No slow queries detected. Performance is optimal!</span>
                    </div>
                  ) : (
                    perfData?.slowQueries.map((query, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-card space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 block overflow-x-auto">
                            {query.query.substring(0, 200)}
                            {query.query.length > 200 && '...'}
                          </code>
                          <Badge variant={query.mean_time > 1000 ? "destructive" : "secondary"}>
                            {formatTime(query.mean_time)}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Calls: {query.calls.toLocaleString()}</span>
                          <span>Total: {formatTime(query.total_time)}</span>
                          <span>Rows: {query.rows.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes">
          <Card>
            <CardHeader>
              <CardTitle>Index Usage Statistics</CardTitle>
              <CardDescription>
                How frequently indexes are being used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Index</TableHead>
                      <TableHead className="text-right">Scans</TableHead>
                      <TableHead className="text-right">Rows Read</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perfData?.indexUsage.map((idx, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{idx.table_name}</TableCell>
                        <TableCell className="font-mono text-xs">{idx.index_name}</TableCell>
                        <TableCell className="text-right">
                          {idx.index_scans.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {idx.rows_read.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {idx.index_scans === 0 ? (
                            <Badge variant="destructive">Unused</Badge>
                          ) : idx.index_scans < 10 ? (
                            <Badge variant="secondary">Low Usage</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}