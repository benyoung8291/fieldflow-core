import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditorLazy as RichTextEditor } from "@/components/ui/RichTextEditorLazy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { X, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KnowledgeArticleEditorProps {
  articleId: string | null;
  categoryId: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export function KnowledgeArticleEditor({
  articleId,
  categoryId: initialCategoryId,
  onSave,
  onCancel,
}: KnowledgeArticleEditorProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId || "");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  const { data: article } = useQuery({
    queryKey: ["knowledge-article", articleId],
    queryFn: async () => {
      if (!articleId) return null;

      const { data, error } = await supabase
        .from("knowledge_articles")
        .select(`
          *,
          knowledge_article_tags (
            tag_id
          )
        `)
        .eq("id", articleId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!articleId,
  });

  const { data: categories } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: tags } = useQuery({
    queryKey: ["knowledge-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_tags")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setSummary(article.summary || "");
      setContent(article.content);
      setCategoryId(article.category_id || "");
      setStatus(article.status as "draft" | "published");
      setIsFeatured(article.is_featured);
      setSelectedTags(
        article.knowledge_article_tags?.map((t: any) => t.tag_id) || []
      );
    }
  }, [article]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error("No tenant");

      const articleData = {
        title,
        summary,
        content,
        category_id: categoryId || null,
        status,
        is_featured: isFeatured,
        tenant_id: profile.tenant_id,
        last_edited_by: profile.id,
        ...(status === "published" && !article?.published_at && {
          published_at: new Date().toISOString(),
        }),
      };

      let savedArticleId = articleId;

      if (articleId) {
        const { error } = await supabase
          .from("knowledge_articles")
          .update(articleData)
          .eq("id", articleId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("knowledge_articles")
          .insert({
            ...articleData,
            created_by: profile.id,
          })
          .select()
          .single();

        if (error) throw error;
        savedArticleId = data.id;
      }

      // Update tags
      if (savedArticleId) {
        // Delete existing tags
        await supabase
          .from("knowledge_article_tags")
          .delete()
          .eq("article_id", savedArticleId);

        // Insert new tags
        if (selectedTags.length > 0) {
          const tagRelations = selectedTags.map((tagId) => ({
            article_id: savedArticleId,
            tag_id: tagId,
          }));

          await supabase.from("knowledge_article_tags").insert(tagRelations);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-article", articleId] });
      onSave();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      if (!profile?.tenant_id) throw new Error("No tenant");

      const { data, error } = await supabase
        .from("knowledge_tags")
        .insert({
          name: tagName,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-tags"] });
      setSelectedTags([...selectedTags, newTag.id]);
      setNewTag("");
    },
  });

  const handleAddTag = () => {
    if (newTag.trim()) {
      createTagMutation.mutate(newTag.trim());
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={onCancel} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </Button>
              <h1 className="text-xl font-semibold">
                {articleId ? "Edit Article" : "Create Article"}
              </h1>
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!title || !content || saveMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save Article"}
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <ScrollArea className="flex-1">
        <div className="container max-w-4xl py-8">
          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter article title..."
                className="text-lg"
              />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary of the article..."
                rows={2}
              />
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as "draft" | "published")}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Featured */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Featured Article</Label>
                <p className="text-sm text-muted-foreground">
                  Featured articles appear at the top
                </p>
              </div>
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button type="button" onClick={handleAddTag} variant="secondary">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags
                  ?.filter((tag) => selectedTags.includes(tag.id))
                  .map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="gap-1">
                      {tag.name}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() =>
                          setSelectedTags(selectedTags.filter((id) => id !== tag.id))
                        }
                      />
                    </Badge>
                  ))}
              </div>
              {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags
                    .filter((tag) => !selectedTags.includes(tag.id))
                    .map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => setSelectedTags([...selectedTags, tag.id])}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label>Content</Label>
              <Card className="p-4">
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write your article content..."
                />
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
