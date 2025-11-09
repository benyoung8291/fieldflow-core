import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCheck, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkerSuggestionsProps {
  serviceOrderId: string;
  onSelectWorker: (workerId: string) => void;
  selectedWorkerId?: string;
}

interface WorkerMatch {
  worker_id: string;
  worker_name: string;
  matching_skills: Array<{
    skill_name: string;
    proficiency_level: string;
    category?: string;
  }>;
  match_score: number;
  total_required_skills: number;
  matched_skills_count: number;
}

const proficiencyScores = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const proficiencyColors = {
  beginner: "bg-gray-500",
  intermediate: "bg-blue-500",
  advanced: "bg-green-500",
  expert: "bg-purple-500",
};

export default function WorkerSuggestions({
  serviceOrderId,
  onSelectWorker,
  selectedWorkerId,
}: WorkerSuggestionsProps) {
  const { data: workerMatches, isLoading } = useQuery({
    queryKey: ["worker-suggestions", serviceOrderId],
    queryFn: async () => {
      // Get required skills for the service order
      const { data: requiredSkills, error: skillsError } = await supabase
        .from("service_order_skills")
        .select(`
          skill_id,
          skills(name, category)
        `)
        .eq("service_order_id", serviceOrderId);

      if (skillsError) throw skillsError;
      if (!requiredSkills || requiredSkills.length === 0) return [];

      const requiredSkillIds = requiredSkills.map((rs) => rs.skill_id);

      // Get all workers with their skills
      const { data: workerSkills, error: workerSkillsError } = await supabase
        .from("worker_skills")
        .select(`
          worker_id,
          skill_id,
          proficiency_level,
          profiles!worker_skills_worker_id_fkey(
            id,
            first_name,
            last_name,
            is_active
          ),
          skills(name, category)
        `)
        .in("skill_id", requiredSkillIds)
        .eq("profiles.is_active", true);

      if (workerSkillsError) throw workerSkillsError;
      if (!workerSkills || workerSkills.length === 0) return [];

      // Group by worker and calculate match scores
      const workerMap = new Map<string, WorkerMatch>();

      workerSkills.forEach((ws: any) => {
        const workerId = ws.worker_id;
        const workerName = `${ws.profiles.first_name} ${ws.profiles.last_name}`;

        if (!workerMap.has(workerId)) {
          workerMap.set(workerId, {
            worker_id: workerId,
            worker_name: workerName,
            matching_skills: [],
            match_score: 0,
            total_required_skills: requiredSkills.length,
            matched_skills_count: 0,
          });
        }

        const worker = workerMap.get(workerId)!;
        worker.matching_skills.push({
          skill_name: ws.skills.name,
          proficiency_level: ws.proficiency_level,
          category: ws.skills.category,
        });
        worker.matched_skills_count += 1;

        // Add proficiency score
        const profScore = proficiencyScores[ws.proficiency_level as keyof typeof proficiencyScores] || 0;
        worker.match_score += profScore;
      });

      // Convert to array and sort by match score (descending)
      const matches = Array.from(workerMap.values()).sort((a, b) => {
        // First, prioritize workers who have all required skills
        if (a.matched_skills_count !== b.matched_skills_count) {
          return b.matched_skills_count - a.matched_skills_count;
        }
        // Then sort by proficiency score
        return b.match_score - a.match_score;
      });

      return matches;
    },
    enabled: !!serviceOrderId,
  });

  if (!serviceOrderId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Suggested Workers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!workerMatches || workerMatches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Suggested Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No workers found with the required skills for this service order.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Suggested Workers ({workerMatches.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Based on required skills and proficiency levels
        </p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
        {workerMatches.map((match) => (
          <div
            key={match.worker_id}
            className={`p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
              selectedWorkerId === match.worker_id ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{match.worker_name}</span>
                  {match.matched_skills_count === match.total_required_skills && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                      <Award className="h-3 w-3 mr-1" />
                      Perfect Match
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {match.matched_skills_count} of {match.total_required_skills} required skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {match.matching_skills.map((skill, idx) => (
                    <Badge
                      key={idx}
                      className={`text-xs ${proficiencyColors[skill.proficiency_level as keyof typeof proficiencyColors]}`}
                    >
                      {skill.skill_name} · {skill.proficiency_level}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                variant={selectedWorkerId === match.worker_id ? "default" : "outline"}
                onClick={() => onSelectWorker(match.worker_id)}
              >
                {selectedWorkerId === match.worker_id ? "Selected" : "Select"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
