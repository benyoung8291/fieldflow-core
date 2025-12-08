import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MapPin, Users, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function ImportHub() {
  const navigate = useNavigate();

  const { data: locationStats } = useQuery({
    queryKey: ['import-location-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('airtable_location_mapping')
        .select('match_status');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const mapped = data?.filter(d => d.match_status === 'matched' || d.match_status === 'manual').length || 0;
      const pending = data?.filter(d => d.match_status === 'pending').length || 0;
      
      return { total, mapped, pending };
    }
  });

  const { data: workerStats } = useQuery({
    queryKey: ['import-worker-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('airtable_worker_mapping')
        .select('match_status');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const mapped = data?.filter(d => d.match_status === 'matched' || d.match_status === 'manual' || d.match_status === 'created').length || 0;
      const pending = data?.filter(d => d.match_status === 'pending').length || 0;
      
      return { total, mapped, pending };
    }
  });

  const importSteps = [
    {
      title: "Location Mapping",
      description: "Map Airtable locations to customers and sites",
      icon: MapPin,
      path: "/settings/import/locations",
      stats: locationStats,
      step: 1
    },
    {
      title: "Worker Mapping",
      description: "Map technician names to internal workers or subcontractors",
      icon: Users,
      path: "/settings/import/workers",
      stats: workerStats,
      step: 2
    },
    {
      title: "Field Report Import",
      description: "Import historical field reports with PDFs",
      icon: FileText,
      path: "/settings/import/field-reports",
      stats: null,
      step: 3,
      requiresComplete: true
    }
  ];

  const getStatusBadge = (stats: { total: number; mapped: number; pending: number } | null | undefined) => {
    if (!stats || stats.total === 0) {
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Not Started</Badge>;
    }
    if (stats.pending === 0) {
      return <Badge className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" /> Complete</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> {stats.mapped}/{stats.total} Mapped</Badge>;
  };

  const canProceedToImport = locationStats?.pending === 0 && workerStats?.pending === 0 && 
    (locationStats?.total || 0) > 0 && (workerStats?.total || 0) > 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Import</h1>
        <p className="text-muted-foreground mt-1">
          Import historical field reports from Airtable
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {importSteps.map((step) => {
          const Icon = step.icon;
          const isDisabled = step.requiresComplete && !canProceedToImport;
          
          return (
            <Card 
              key={step.path} 
              className={`relative ${isDisabled ? 'opacity-60' : 'hover:border-primary/50 cursor-pointer transition-colors'}`}
              onClick={() => !isDisabled && navigate(step.path)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Step {step.step}: {step.title}</CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription>{step.description}</CardDescription>
                
                <div className="flex items-center justify-between">
                  {step.stats !== null ? (
                    getStatusBadge(step.stats)
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" /> Awaiting Prerequisites
                    </Badge>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(step.path);
                    }}
                  >
                    {step.stats?.total ? 'Continue' : 'Start'}
                  </Button>
                </div>

                {isDisabled && (
                  <p className="text-xs text-muted-foreground">
                    Complete location and worker mapping first
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="space-y-2">
            <li><strong>Step 1 - Location Mapping:</strong> Upload your Airtable locations CSV and map each location to a customer and site in the system. Use auto-matching and manually resolve any unmatched locations.</li>
            <li><strong>Step 2 - Worker Mapping:</strong> Map technician names to internal workers or create subcontractor contacts for external workers. You can retry auto-matching after creating new contacts.</li>
            <li><strong>Step 3 - Field Report Import:</strong> Once all locations and workers are mapped, import the field reports. The system will download PDFs from Airtable and upload them to storage.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
