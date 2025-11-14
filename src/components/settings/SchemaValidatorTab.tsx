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

    // Group tables by type for better organization
    const tableGroups = {
      core: ['customers', 'profiles', 'service_orders', 'appointments', 'projects'],
      financial: ['invoices', 'quotes', 'expenses', 'credit_card_transactions', 'company_credit_cards'],
      settings: ['brand_colors', 'general_settings', 'crm_status_settings', 'crm_pipelines', 'expense_categories', 'expense_policy_rules'],
      helpdesk: ['helpdesk_tickets', 'helpdesk_messages', 'helpdesk_linked_documents', 'helpdesk_email_accounts', 'helpdesk_pipelines'],
      supporting: [], // Everything else
    };

    // Categorize tables
    schemaData.tables.forEach(table => {
      let found = false;
      for (const [group, tables] of Object.entries(tableGroups)) {
        if (tables.includes(table)) {
          found = true;
          break;
        }
      }
      if (!found) {
        tableGroups.supporting.push(table);
      }
    });

    // Create nodes with hierarchical layout
    let yOffset = 0;
    const groupSpacing = 250;
    const nodeSpacing = { x: 280, y: 100 };

    Object.entries(tableGroups).forEach(([groupName, tables]) => {
      if (tables.length === 0) return;
      
      tables.forEach((table, index) => {
        const columnCount = schemaData.columns[table]?.length || 0;
        const fkCount = schemaData.relationships.filter((rel: any) => 
          rel.from === table || rel.to === table
        ).length;

        const row = Math.floor(index / 4);
        const col = index % 4;

        nodes.push({
          id: table,
          type: 'default',
          position: { 
            x: col * nodeSpacing.x, 
            y: yOffset + (row * nodeSpacing.y) 
          },
          data: {
            label: (
              <div className="text-xs">
                <div className="font-bold mb-1">{table}</div>
                <div className="text-muted-foreground">
                  {columnCount} cols · {fkCount} links
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

      yOffset += Math.ceil(tables.length / 4) * nodeSpacing.y + groupSpacing;
    });

    // Create edges for relationships with different styles based on type
    schemaData.relationships.forEach((rel, index) => {
      const edgeStyle = {
        'foreign_key': { 
          stroke: 'hsl(var(--primary))', 
          strokeWidth: 2,
          label: 'FK'
        },
        'logical': { 
          stroke: 'hsl(var(--secondary))', 
          strokeWidth: 1.5,
          strokeDasharray: '5,5',
          label: 'Logical'
        },
        'settings': { 
          stroke: 'hsl(var(--accent))', 
          strokeWidth: 1,
          strokeDasharray: '3,3',
          label: 'Settings'
        },
        'system': { 
          stroke: 'hsl(var(--muted-foreground))', 
          strokeWidth: 1,
          strokeDasharray: '2,2',
          label: 'System'
        },
      }[rel.type] || { stroke: 'hsl(var(--border))', strokeWidth: 1, label: '' };

      edges.push({
        id: `${rel.from}-${rel.to}-${index}`,
        source: rel.from,
        target: rel.to,
        type: 'smoothstep',
        animated: rel.type === 'foreign_key',
        style: { 
          stroke: edgeStyle.stroke, 
          strokeWidth: edgeStyle.strokeWidth,
          strokeDasharray: edgeStyle.strokeDasharray 
        },
        label: edgeStyle.label,
        labelStyle: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' },
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
                Visual representation of table connections: 
                <span className="inline-flex items-center gap-4 ml-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-primary"></span> Foreign Keys
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-secondary" style={{backgroundImage: 'repeating-linear-gradient(to right, hsl(var(--secondary)) 0, hsl(var(--secondary)) 3px, transparent 3px, transparent 6px)'}}></span> Logical
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-accent" style={{backgroundImage: 'repeating-linear-gradient(to right, hsl(var(--accent)) 0, hsl(var(--accent)) 2px, transparent 2px, transparent 4px)'}}></span> Settings
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-muted-foreground" style={{backgroundImage: 'repeating-linear-gradient(to right, hsl(var(--muted-foreground)) 0, hsl(var(--muted-foreground)) 1px, transparent 1px, transparent 3px)'}}></span> System
                  </span>
                </span>
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
                    <CardTitle className="flex items-center gap-2">
                      {table}
                      <Badge variant="outline" className="text-xs">
                        {schemaData.columns[table]?.length || 0} columns
                      </Badge>
                    </CardTitle>
                    <Badge variant="secondary">
                      {schemaData.relationships.filter((rel: any) => 
                        rel.from === table || rel.to === table
                      ).length} relationships
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