import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, BookOpen } from "lucide-react";
import { KnowledgeArticleList } from "@/components/knowledge/KnowledgeArticleList";
import { KnowledgeArticleView } from "@/components/knowledge/KnowledgeArticleView";
import { KnowledgeArticleEditor } from "@/components/knowledge/KnowledgeArticleEditor";
import { KnowledgeCategoryNav } from "@/components/knowledge/KnowledgeCategoryNav";
import { ModuleTutorial } from "@/components/onboarding/ModuleTutorial";
import { TUTORIAL_CONTENT } from "@/data/tutorialContent";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { useCanManageKnowledge } from "@/hooks/useUserRole";

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const { toast } = useToast();
  const { hasRole: canManageKnowledge } = useCanManageKnowledge();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const handleCreateArticle = () => {
    setEditingArticleId(null);
    setIsEditing(true);
    setSelectedArticleId(null);
  };

  const handleEditArticle = (articleId: string) => {
    setEditingArticleId(articleId);
    setIsEditing(true);
    setSelectedArticleId(null);
  };

  const handleArticleSaved = () => {
    setIsEditing(false);
    setEditingArticleId(null);
    toast({
      title: "Success",
      description: "Article saved successfully",
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingArticleId(null);
  };

  if (isEditing) {
    return (
      <KnowledgeArticleEditor
        articleId={editingArticleId}
        categoryId={selectedCategoryId}
        onSave={handleArticleSaved}
        onCancel={handleCancelEdit}
      />
    );
  }

  if (selectedArticleId) {
    return (
      <KnowledgeArticleView
        articleId={selectedArticleId}
        onBack={() => setSelectedArticleId(null)}
        onEdit={handleEditArticle}
        onSelectArticle={setSelectedArticleId}
      />
    );
  }

  return (
    <DashboardLayout>
    <div className="h-full flex flex-col">
      <ModuleTutorial
        moduleName="Knowledge Base"
        title={TUTORIAL_CONTENT.knowledgeBase.title}
        description={TUTORIAL_CONTENT.knowledgeBase.description}
        defaultSteps={TUTORIAL_CONTENT.knowledgeBase.steps}
      />
      
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Knowledge Base</h1>
                <p className="text-sm text-muted-foreground">
                  Discover, share, and collaborate on knowledge
                </p>
              </div>
            </div>
            {canManageKnowledge && (
              <Button onClick={handleCreateArticle} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Article
              </Button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search articles, topics, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="container h-full">
          <div className="flex gap-6 h-full py-6">
            {/* Category Navigation */}
            <div className="w-64 flex-shrink-0">
              <KnowledgeCategoryNav
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
              />
            </div>

            {/* Articles List */}
            <div className="flex-1 overflow-auto">
              <KnowledgeArticleList
                searchQuery={searchQuery}
                categoryId={selectedCategoryId}
                onSelectArticle={setSelectedArticleId}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
