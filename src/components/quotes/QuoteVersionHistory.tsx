import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, FileText, GitCompare } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import QuoteVersionComparisonDialog from "./QuoteVersionComparisonDialog";

interface QuoteVersionHistoryProps {
  quoteId: string;
}

export default function QuoteVersionHistory({ quoteId }: QuoteVersionHistoryProps) {
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["quote-versions", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_versions")
        .select("*")
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: currentQuote } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: currentLineItems = [] } = useQuery({
    queryKey: ["quote-line-items", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("item_order");

      if (error) throw error;
      return data;
    },
  });

  const versionTypeColors = {
    conversion: "bg-success/10 text-success",
    unlock: "bg-warning/10 text-warning",
    manual: "bg-info/10 text-info",
  };

  const versionTypeLabels = {
    conversion: "Converted",
    unlock: "Unlocked",
    manual: "Manual Save",
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading versions...</p>
        </CardContent>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No version history available. Versions are automatically created when a quote is converted.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Version {version.version_number}</span>
                    <Badge className={versionTypeColors[version.quote_type as keyof typeof versionTypeColors]}>
                      {versionTypeLabels[version.quote_type as keyof typeof versionTypeLabels]}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {format(new Date(version.created_at), "PPp")}
                  </div>

                  {version.change_description && (
                    <p className="text-sm text-muted-foreground">{version.change_description}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Subtotal: </span>
                      <span className="font-medium">${Number(version.subtotal).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax: </span>
                      <span className="font-medium">${Number(version.tax_amount).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-medium">${Number(version.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedVersion(version);
                    setCompareDialogOpen(true);
                  }}
                  className="shrink-0"
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedVersion && currentQuote && (
        <QuoteVersionComparisonDialog
          open={compareDialogOpen}
          onOpenChange={setCompareDialogOpen}
          currentQuote={currentQuote}
          currentLineItems={currentLineItems}
          versionSnapshot={selectedVersion}
        />
      )}
    </>
  );
}
