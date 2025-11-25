import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Lightbulb, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeArticleSuggestionsProps {
  articleId: string;
}

export function KnowledgeArticleSuggestions({
  articleId,
}: KnowledgeArticleSuggestionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState<"edit" | "improvement">(
    "improvement"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: suggestions } = useQuery({
    queryKey: ["knowledge-suggestions", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_article_suggestions")
        .select("*")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createSuggestionMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !profile.tenant_id) {
        throw new Error("Not authenticated");
      }

      const { error } = await supabase
        .from("knowledge_article_suggestions")
        .insert({
          article_id: articleId,
          suggestion_type: suggestionType,
          title,
          description,
          tenant_id: profile.tenant_id,
          created_by: profile.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
      setIsDialogOpen(false);
      setTitle("");
      setDescription("");
      toast({
        title: "Suggestion submitted",
        description: "Thank you for helping improve our knowledge base!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "implemented":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Suggestions & Improvements
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Suggest Improvement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suggest an Improvement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={suggestionType}
                  onValueChange={(v) =>
                    setSuggestionType(v as "edit" | "improvement")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edit">Edit / Correction</SelectItem>
                    <SelectItem value="improvement">General Improvement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggestion-title">Title</Label>
                <Input
                  id="suggestion-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief title for your suggestion"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggestion-description">Description</Label>
                <Textarea
                  id="suggestion-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your suggestion in detail..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createSuggestionMutation.mutate()}
                  disabled={!title || !description || createSuggestionMutation.isPending}
                >
                  Submit Suggestion
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {suggestions && suggestions.length > 0 ? (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="border border-border rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{suggestion.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.description}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={getStatusColor(suggestion.status)}
                >
                  {suggestion.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <Badge variant="secondary">{suggestion.suggestion_type}</Badge>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(suggestion.created_at), {
                    addSuffix: true,
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No suggestions yet. Be the first to suggest an improvement!
        </p>
      )}
    </Card>
  );
}
