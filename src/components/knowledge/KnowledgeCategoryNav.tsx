import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface KnowledgeCategoryNavProps {
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function KnowledgeCategoryNav({
  selectedCategoryId,
  onSelectCategory,
}: KnowledgeCategoryNavProps) {
  const { data: categories } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: articleCounts } = useQuery({
    queryKey: ["knowledge-article-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .select("category_id")
        .eq("status", "published");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((article) => {
        if (article.category_id) {
          counts[article.category_id] = (counts[article.category_id] || 0) + 1;
        }
      });

      return counts;
    },
  });

  const { data: featuredCount } = useQuery({
    queryKey: ["knowledge-featured-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("knowledge_articles")
        .select("*", { count: "exact", head: true })
        .eq("status", "published")
        .eq("is_featured", true);

      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground px-3 mb-3">Browse</h3>

      <Button
        variant={selectedCategoryId === null ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start gap-2",
          selectedCategoryId === null && "bg-secondary"
        )}
        onClick={() => onSelectCategory(null)}
      >
        <FolderOpen className="h-4 w-4" />
        All Articles
      </Button>

      {featuredCount && featuredCount > 0 && (
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => onSelectCategory(null)}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Featured
          <span className="ml-auto text-xs text-muted-foreground">{featuredCount}</span>
        </Button>
      )}

      <div className="h-px bg-border my-3" />

      <h3 className="text-sm font-medium text-muted-foreground px-3 mb-3">Categories</h3>

      <ScrollArea className="h-[calc(100vh-24rem)]">
        <div className="space-y-1">
          {categories?.map((category) => {
            const count = articleCounts?.[category.id] || 0;
            const isSelected = selectedCategoryId === category.id;

            return (
              <Button
                key={category.id}
                variant={isSelected ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2",
                  isSelected && "bg-secondary"
                )}
                onClick={() => onSelectCategory(category.id)}
              >
                <Folder
                  className="h-4 w-4"
                  style={{ color: category.color }}
                />
                <span className="flex-1 text-left truncate">{category.name}</span>
                {count > 0 && (
                  <span className="text-xs text-muted-foreground">{count}</span>
                )}
              </Button>
            );
          })}

          {(!categories || categories.length === 0) && (
            <p className="text-sm text-muted-foreground px-3 py-2">
              No categories yet
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
