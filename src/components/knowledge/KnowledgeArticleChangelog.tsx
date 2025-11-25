import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, User, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeArticleChangelogProps {
  articleId: string;
}

export function KnowledgeArticleChangelog({ articleId }: KnowledgeArticleChangelogProps) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["knowledge-article-versions", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_article_versions")
        .select(`
          *,
          profiles:created_by (
            first_name,
            last_name,
            email
          )
        `)
        .eq("article_id", articleId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Version History</h3>
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Version History</h3>
        </div>
        <p className="text-sm text-muted-foreground">No version history available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Version History</h3>
        <Badge variant="secondary" className="ml-auto">
          {versions.length} {versions.length === 1 ? "version" : "versions"}
        </Badge>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {versions.map((version: any) => (
            <div
              key={version.id}
              className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono text-xs">
                    v{version.version_number}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                {version.change_summary && (
                  <p className="text-sm mb-2">{version.change_summary}</p>
                )}
                
                {version.profiles && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>
                      {version.profiles.first_name} {version.profiles.last_name || ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
