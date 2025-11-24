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
import DOMPurify from "dompurify";

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
  const [selectedActivityType, setSelectedActivityType] = useState<string | undefined>();

  const handleQuickLog = (type: string) => {
    setSelectedActivityType(type);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedActivityType(undefined);
    }
  };

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Activity History</h3>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Log Activity
          </Button>
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickLog('phone_call')}
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            Log Call
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickLog('email')}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Log Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickLog('meeting')}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Log Meeting
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickLog('note')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Add Note
          </Button>
        </div>
      </div>

      {activities && activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.activity_type as keyof typeof activityIcons];
            const colorClass = activityColors[activity.activity_type as keyof typeof activityColors];
            const label = activityLabels[activity.activity_type as keyof typeof activityLabels];

            // Check if description contains HTML tags
            const isHtml = activity.description && /<[^>]+>/.test(activity.description);

            return (
              <Card key={activity.id} className="transition-all hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    <div className={`flex-shrink-0 w-11 h-11 rounded-full ${colorClass} flex items-center justify-center shadow-sm`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-medium">{label}</Badge>
                            <span className="font-semibold text-base">{activity.subject}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1.5">
                            {format(new Date(activity.activity_date), "PPp")}
                          </p>
                        </div>
                      </div>
                      {activity.description && (
                        isHtml ? (
                          <div
                            className="text-sm prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(activity.description)
                            }}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap text-foreground/90">
                            {activity.description}
                          </p>
                        )
                      )}
                      <p className="text-xs text-muted-foreground pt-1 border-t">
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
        onOpenChange={handleDialogClose}
        defaultActivityType={selectedActivityType}
      />
    </div>
  );
}
