import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Map as MapIcon,
  Table as TableIcon
} from "lucide-react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Skeleton } from "@/components/ui/skeleton";

interface SchemaValidationData {
  tables: string[];
  columns: Record<string, any[]>;
  foreignKeys: any[];
  indexes: any[];
  relationships: Array<{ from: string; to: string; type: string }>;
  recommendations: string[];
  stats: {
    totalTables: number;
    totalColumns: number;
    totalForeignKeys: number;
    totalIndexes: number;
  };
}

export function SchemaValidatorTab() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: schemaData, isLoading, refetch } = useQuery({
    queryKey: ["schema-validation"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("validate-schema");
      if (error) throw error;
      return data as SchemaValidationData;
    },
  });

  // Generate nodes and edges for the visual map
  const generateFlowData = () => {
    if (!schemaData) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create nodes for each table
    schemaData.tables.forEach((table, index) => {
      const angle = (index / schemaData.tables.length) * 2 * Math.PI;
      const radius = 400;
      const x = Math.cos(angle) * radius + 500;
      const y = Math.sin(angle) * radius + 400;

      const columnCount = schemaData.columns[table]?.length || 0;
      const fkCount = schemaData.foreignKeys.filter((fk: any) => fk.table_name === table).length;

      nodes.push({
        id: table,
        type: 'default',
        position: { x, y },
        data: {
          label: (
            <div className="text-xs">
              <div className="font-bold mb-1">{table}</div>
              <div className="text-muted-foreground">
                {columnCount} columns · {fkCount} FKs
              </div>
            </div>
          ),
        },
        style: {
          background: 'hsl(var(--card))',
          border: '2px solid hsl(var(--border))',
          borderRadius: '8px',
          padding: '12px',
          minWidth: '150px',
        },
      });
    });

    // Create edges for relationships
    schemaData.relationships.forEach((rel, index) => {
      edges.push({
        id: `${rel.from}-${rel.to}-${index}`,
        source: rel.from,
        target: rel.to,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--primary))' },
        label: 'FK',
        labelStyle: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
      });
    });

    return { nodes, edges };
  };

  const { nodes: initialNodes, edges: initialEdges } = generateFlowData();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update flow when data changes
  useState(() => {
    if (schemaData) {
      const { nodes: newNodes, edges: newEdges } = generateFlowData();
      setNodes(newNodes);
      setEdges(newEdges);
    }
  });

  const getRecommendationIcon = (rec: string) => {
    if (rec.startsWith("⚠️")) return <AlertTriangle className="h-4 w-4 text-warning" />;
    if (rec.startsWith("⚡")) return <Info className="h-4 w-4 text-info" />;
    if (rec.startsWith("🔑")) return <AlertTriangle className="h-4 w-4 text-error" />;
    if (rec.startsWith("💡")) return <Info className="h-4 w-4 text-accent" />;
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
    <div className="flex flex-col h-[calc(100vh-12rem)] space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold">Database Schema Validator</h2>
          <p className="text-muted-foreground">
            Comprehensive analysis of database structure, relationships, and optimization opportunities
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Analysis
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{schemaData?.stats.totalTables || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{schemaData?.stats.totalColumns || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Foreign Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{schemaData?.stats.totalForeignKeys || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Indexes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{schemaData?.stats.totalIndexes || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
          <TabsTrigger value="overview">
            <Database className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="map">
            <MapIcon className="h-4 w-4 mr-2" />
            Visual Map
          </TabsTrigger>
          <TabsTrigger value="tables">
            <TableIcon className="h-4 w-4 mr-2" />
            Tables
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 min-h-0 mt-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>
                Suggested improvements for your database schema
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3">
                  {schemaData?.recommendations.length === 0 ? (
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>No issues found! Your schema looks good.</span>
                    </div>
                  ) : (
                    schemaData?.recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        {getRecommendationIcon(rec)}
                        <span className="text-sm flex-1">
                          {rec.replace(/^[⚠️⚡🔑💡]\s*/, '')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map" className="flex-1 min-h-0 mt-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Database Relationship Map</CardTitle>
              <CardDescription>
                Visual representation of how tables are connected through foreign keys
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
              <div className="h-full w-full border-t bg-muted/20">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  attributionPosition="bottom-left"
                >
                  <Background />
                  <Controls />
                  <MiniMap
                    nodeColor={(node) => 'hsl(var(--primary))'}
                    maskColor="hsl(var(--background) / 0.8)"
                  />
                </ReactFlow>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables" className="flex-1 min-h-0 mt-4 overflow-auto">
          <div className="space-y-4 pb-4">
            {schemaData?.tables.map((table) => (
              <Card key={table}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{table}</CardTitle>
                    <Badge variant="secondary">
                      {schemaData.columns[table]?.length || 0} columns
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {schemaData.columns[table]?.map((col: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded border bg-card text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{col.column_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {col.data_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {col.is_nullable === 'NO' && (
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                          )}
                          {col.column_default?.includes('gen_random_uuid()') && (
                            <Badge variant="secondary" className="text-xs">Auto-generated</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}