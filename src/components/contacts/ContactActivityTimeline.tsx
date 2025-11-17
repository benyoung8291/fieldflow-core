import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Phone, Mail, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import AddContactActivityDialog from "./AddContactActivityDialog";

interface ContactActivityTimelineProps {
  contactId: string;
}

interface ActivityWithCreator {
  id: string;
  tenant_id: string;
  contact_id: string;
  activity_type: string;
  activity_date: string;
  subject: string;
  description: string;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
    email: string;
  };
}

const activityIcons = {
  note: FileText,
  phone_call: Phone,
  email: Mail,
  meeting: Calendar,
};

const activityColors = {
  note: "bg-blue-500",
  phone_call: "bg-green-500",
  email: "bg-purple-500",
  meeting: "bg-orange-500",
};

const activityLabels = {
  note: "Note",
  phone_call: "Phone Call",
  email: "Email",
  meeting: "Meeting",
};

export default function ContactActivityTimeline({ contactId }: ContactActivityTimelineProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: activities, isLoading } = useQuery<ActivityWithCreator[]>({
    queryKey: ["contact-activities", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_activities")
        .select("*")
        .eq("contact_id", contactId)
        .order("activity_date", { ascending: false });

      if (error) throw error;
      
      // Fetch creator info separately
      if (data) {
        const creatorIds = [...new Set(data.map(a => a.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", creatorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, {
          full_name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          email: p.email
        }]) || []);

        return data.map(activity => ({
          ...activity,
          creator: profileMap.get(activity.created_by)
        }));
      }
      
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Activity History</h3>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Log Activity
        </Button>
      </div>

      {activities && activities.length > 0 ? (
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.activity_type as keyof typeof activityIcons];
            const colorClass = activityColors[activity.activity_type as keyof typeof activityColors];
            const label = activityLabels[activity.activity_type as keyof typeof activityLabels];

            return (
              <Card key={activity.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full ${colorClass} flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{label}</Badge>
                            <span className="font-semibold">{activity.subject}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(activity.activity_date), "PPp")}
                          </p>
                        </div>
                      </div>
                      {activity.description && (
                        <p className="text-sm whitespace-pre-wrap">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Logged by {activity.creator?.full_name || activity.creator?.email || "Unknown"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activities logged yet</p>
            <p className="text-sm mt-2">Click "Log Activity" to record your first interaction</p>
          </CardContent>
        </Card>
      )}

      <AddContactActivityDialog
        contactId={contactId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
