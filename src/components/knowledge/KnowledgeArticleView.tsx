import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  FileText,
  MessageSquare,
  Download,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { KnowledgeArticleFeedback } from "./KnowledgeArticleFeedback";
import { KnowledgeArticleSuggestions } from "./KnowledgeArticleSuggestions";
import { KnowledgeArticleAttachments } from "./KnowledgeArticleAttachments";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PolicyDocumentRenderer } from "./PolicyDocumentRenderer";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { KnowledgeBaseSidebar } from "./KnowledgeBaseSidebar";

interface KnowledgeArticleViewProps {
  articleId: string;
  onBack: () => void;
  onEdit: (articleId: string) => void;
  onSelectArticle?: (articleId: string) => void;
}

export function KnowledgeArticleView({
  articleId,
  onBack,
  onEdit,
  onSelectArticle,
}: KnowledgeArticleViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { data: article } = useQuery({
    queryKey: ["knowledge-article", articleId],
    queryFn: async () => {
      // Increment view count
      const { data: currentArticle } = await supabase
        .from("knowledge_articles")
        .select("view_count")
        .eq("id", articleId)
        .single();

      if (currentArticle) {
        await supabase
          .from("knowledge_articles")
          .update({ view_count: (currentArticle.view_count || 0) + 1 })
          .eq("id", articleId);
      }

      const { data, error } = await supabase
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
        .eq("id", articleId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  if (!article) {
    return null;
  }

  const canEdit = profile?.id === article.created_by;

  const handleSelectArticle = (id: string) => {
    if (onSelectArticle) {
      onSelectArticle(id);
    }
  };

  const handleSelectCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <KnowledgeBaseSidebar
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
          onSelectArticle={handleSelectArticle}
        />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <Button variant="ghost" onClick={onBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
              {canEdit && (
                <Button onClick={() => onEdit(articleId)} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Article
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
        <div className="container max-w-4xl py-8">
          {/* Article Content */}
          {article.knowledge_categories?.name === "Company Policies" || 
           article.knowledge_categories?.name === "Compliance & Safety" ? (
            <>
              {/* Policy Header */}
              <div className="mb-8">
                {article.knowledge_categories && (
                  <Badge className="mb-3 bg-primary/20 text-primary hover:bg-primary/30">
                    {article.knowledge_categories.name}
                  </Badge>
                )}
                <h1 className="text-3xl md:text-4xl font-bold mb-3">{article.title}</h1>
                {article.summary && (
                  <p className="text-lg text-muted-foreground mb-4">{article.summary}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Official Policy Document
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground mt-4">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    {article.view_count} views
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ThumbsUp className="h-4 w-4" />
                    {article.helpful_count} helpful
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Updated {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
              <PolicyDocumentRenderer
                content={article.content}
                title={article.title}
                category={article.knowledge_categories?.name}
              />
            </>
          ) : (
            <>
              {/* Standard Article Header */}
              <div className="mb-8">
                <div className="flex flex-wrap gap-2 mb-4">
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
                  {article.knowledge_article_tags?.map((tagRelation: any) => (
                    <Badge key={tagRelation.knowledge_tags.id} variant="secondary">
                      {tagRelation.knowledge_tags.name}
                    </Badge>
                  ))}
                </div>

                <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

                {article.summary && (
                  <p className="text-lg text-muted-foreground mb-6">{article.summary}</p>
                )}

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    {article.view_count} views
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ThumbsUp className="h-4 w-4" />
                    {article.helpful_count} helpful
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Updated {formatDistanceToNow(new Date(article.updated_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
              <Card className="p-8 mb-8">
                <div
                  className="prose prose-slate dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              </Card>
            </>
          )}

          {/* Attachments */}
          <KnowledgeArticleAttachments articleId={articleId} />

          {/* Feedback */}
          <KnowledgeArticleFeedback articleId={articleId} />

          {/* Suggestions */}
          <KnowledgeArticleSuggestions articleId={articleId} />
          </div>
          </ScrollArea>
        </div>
      </div>
    </SidebarProvider>
  );
}
