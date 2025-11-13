import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface QuoteVersionHistoryProps {
  quoteId: string;
}

export default function QuoteVersionHistory({ quoteId }: QuoteVersionHistoryProps) {
  const { data: versions } = useQuery({
    queryKey: ["quote-versions", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_versions")
        .select(`
          *,
          changed_by_profile:profiles!quote_versions_changed_by_fkey(first_name, last_name)
        `)
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No version history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {versions.map((version: any) => (
          <div key={version.id} className="border-l-2 border-primary pl-4 pb-4 last:pb-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Version {version.version_number}</Badge>
                  <span className="text-sm font-medium">{version.title}</span>
                </div>
                {version.change_description && (
                  <p className="text-sm text-muted-foreground">{version.change_description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {version.changed_by_profile?.first_name} {version.changed_by_profile?.last_name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(version.created_at), "MMM d, yyyy h:mm a")}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Total: {formatCurrency(version.total_amount)} • Type: {version.quote_type}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
