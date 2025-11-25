import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeArticleFeedbackProps {
  articleId: string;
}

export function KnowledgeArticleFeedback({ articleId }: KnowledgeArticleFeedbackProps) {
  const [comment, setComment] = useState("");
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

  const { data: userFeedback } = useQuery({
    queryKey: ["knowledge-feedback", articleId, profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data } = await supabase
        .from("knowledge_article_feedback")
        .select("*")
        .eq("article_id", articleId)
        .eq("user_id", profile.id)
        .maybeSingle();

      return data;
    },
    enabled: !!profile?.id,
  });

  const feedbackMutation = useMutation({
    mutationFn: async (isHelpful: boolean) => {
      if (!profile?.id || !profile.tenant_id) {
        throw new Error("Not authenticated");
      }

      if (userFeedback) {
        const { error } = await supabase
          .from("knowledge_article_feedback")
          .update({
            is_helpful: isHelpful,
            comment: comment || null,
          })
          .eq("id", userFeedback.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("knowledge_article_feedback")
          .insert({
            article_id: articleId,
            user_id: profile.id,
            tenant_id: profile.tenant_id,
            is_helpful: isHelpful,
            comment: comment || null,
          });

        if (error) throw error;
      }

      // Update article counts
      const countField = isHelpful ? "helpful_count" : "not_helpful_count";
      const { data: article } = await supabase
        .from("knowledge_articles")
        .select(countField)
        .eq("id", articleId)
        .single();

      if (article) {
        await supabase
          .from("knowledge_articles")
          .update({
            [countField]: (article[countField] || 0) + 1,
          })
          .eq("id", articleId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-article"] });
      setComment("");
      toast({
        title: "Thank you!",
        description: "Your feedback helps us improve our knowledge base",
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

  return (
    <Card className="p-6 mb-8">
      <h3 className="text-lg font-semibold mb-4">Was this article helpful?</h3>

      {userFeedback ? (
        <div className="text-sm text-muted-foreground">
          You marked this article as {userFeedback.is_helpful ? "helpful" : "not helpful"}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => feedbackMutation.mutate(true)}
              disabled={feedbackMutation.isPending}
            >
              <ThumbsUp className="h-4 w-4" />
              Yes, helpful
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => feedbackMutation.mutate(false)}
              disabled={feedbackMutation.isPending}
            >
              <ThumbsDown className="h-4 w-4" />
              No, not helpful
            </Button>
          </div>

          <div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any additional feedback? (optional)"
              rows={3}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
