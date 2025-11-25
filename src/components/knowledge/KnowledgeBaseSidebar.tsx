import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Folder, FolderOpen, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface KnowledgeBaseSidebarProps {
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onSelectArticle: (articleId: string) => void;
}

export function KnowledgeBaseSidebar({
  selectedCategoryId,
  onSelectCategory,
  onSelectArticle,
}: KnowledgeBaseSidebarProps) {
  const { open } = useSidebar();

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

  const { data: categoryArticles } = useQuery({
    queryKey: ["knowledge-category-articles", selectedCategoryId],
    queryFn: async () => {
      if (!selectedCategoryId) return [];
      
      const { data, error } = await supabase
        .from("knowledge_articles")
        .select("id, title")
        .eq("category_id", selectedCategoryId)
        .eq("status", "published")
        .order("title");

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCategoryId,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Browse Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onSelectCategory(null)}
                  isActive={selectedCategoryId === null}
                  tooltip="All Articles"
                >
                  <FolderOpen className="h-4 w-4" />
                  {open && <span>All Articles</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {featuredCount && featuredCount > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onSelectCategory(null)}
                    tooltip="Featured"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    {open && (
                      <>
                        <span>Featured</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {featuredCount}
                        </span>
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Categories Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories?.map((category) => {
                const count = articleCounts?.[category.id] || 0;
                const isSelected = selectedCategoryId === category.id;

                return (
                  <SidebarMenuItem key={category.id}>
                    <SidebarMenuButton
                      onClick={() => onSelectCategory(category.id)}
                      isActive={isSelected}
                      tooltip={category.name}
                    >
                      <Folder
                        className="h-4 w-4"
                        style={{ color: category.color }}
                      />
                      {open && (
                        <>
                          <span className="flex-1 truncate">{category.name}</span>
                          {count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {(!categories || categories.length === 0) && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No categories yet
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Articles in Selected Category */}
        {selectedCategoryId && categoryArticles && categoryArticles.length > 0 && open && (
          <SidebarGroup>
            <SidebarGroupLabel>Articles</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {categoryArticles.map((article) => (
                  <SidebarMenuItem key={article.id}>
                    <SidebarMenuButton
                      onClick={() => onSelectArticle(article.id)}
                      tooltip={article.title}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span className="flex-1 truncate text-sm">
                        {article.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
