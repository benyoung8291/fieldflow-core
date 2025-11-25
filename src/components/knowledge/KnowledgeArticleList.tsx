import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Eye, ThumbsUp, FileText, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface KnowledgeArticleListProps {
  searchQuery: string;
  categoryId: string | null;
  onSelectArticle: (articleId: string) => void;
}

export function KnowledgeArticleList({
  searchQuery,
  categoryId,
  onSelectArticle,
}: KnowledgeArticleListProps) {
  const { data: articles, isLoading } = useQuery({
    queryKey: ["knowledge-articles", searchQuery, categoryId],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_articles")
        .select(`
          *,
          knowledge_categories (
            id,
            name,
            color,
            icon
          ),
          knowledge_article_tags (
            knowledge_tags (
              id,
              name,
              color
            )
          )
        `)
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </Card>
        ))}
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No articles found</h3>
        <p className="text-sm text-muted-foreground">
          {searchQuery
            ? "Try adjusting your search terms"
            : "Create your first article to get started"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <Card
          key={article.id}
          className="p-6 cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
          onClick={() => onSelectArticle(article.id)}
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {article.is_featured && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Featured
                  </Badge>
                )}
                {article.knowledge_categories && (
                  <Badge
                    style={{
                      backgroundColor: `${article.knowledge_categories.color}20`,
                      color: article.knowledge_categories.color,
                      borderColor: article.knowledge_categories.color,
                    }}
                    variant="outline"
                  >
                    {article.knowledge_categories.name}
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold group-hover:text-primary transition-colors mb-2">
                {article.title}
              </h3>
              {article.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {article.summary}
                </p>
              )}
              {article.knowledge_article_tags &&
                article.knowledge_article_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {article.knowledge_article_tags.slice(0, 5).map((tagRelation: any) => (
                      <Badge
                        key={tagRelation.knowledge_tags.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tagRelation.knowledge_tags.name}
                      </Badge>
                    ))}
                  </div>
                )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {article.view_count}
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {article.helpful_count}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true })}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
