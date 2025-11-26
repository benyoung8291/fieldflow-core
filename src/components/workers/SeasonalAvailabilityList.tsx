import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { SeasonalAvailabilityDialog } from "./SeasonalAvailabilityDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SeasonalAvailabilityListProps {
  workerId: string;
  tenantId: string;
}

export function SeasonalAvailabilityList({ workerId, tenantId }: SeasonalAvailabilityListProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: seasonalAvailability = [], isLoading } = useQuery({
    queryKey: ['seasonal-availability', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_seasonal_availability')
        .select('*')
        .eq('worker_id', workerId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('worker_seasonal_availability')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonal-availability'] });
      toast.success("Seasonal availability deleted");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Failed to delete seasonal availability");
    },
  });

  const handleEdit = (data: any) => {
    setEditingData(data);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingData(null);
    setDialogOpen(true);
  };

  // Fetch date-specific availability for each period
  const { data: allDates = [] } = useQuery({
    queryKey: ['seasonal-availability-dates', workerId],
    queryFn: async () => {
      const periodIds = seasonalAvailability.map((p: any) => p.id);
      if (periodIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('worker_seasonal_availability_dates')
        .select('*')
        .in('seasonal_availability_id', periodIds)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: seasonalAvailability.length > 0,
  });

  const getDatesByPeriod = (periodId: string) => {
    return allDates.filter((d: any) => d.seasonal_availability_id === periodId);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Seasonal Availability Overrides</CardTitle>
              <CardDescription>
                Manage special availability periods (e.g., Christmas, holidays)
              </CardDescription>
            </div>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Period
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : seasonalAvailability.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No seasonal availability periods configured</p>
              <p className="text-sm mt-1">Add periods when your regular schedule changes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {seasonalAvailability.map((period: any) => {
                const dates = getDatesByPeriod(period.id);
                const isActive = 
                  new Date(period.start_date) <= new Date() &&
                  new Date(period.end_date) >= new Date();

                return (
                  <div
                    key={period.id}
                    className="border rounded-lg p-4 space-y-3 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{period.season_name}</h4>
                          {isActive && (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(period.start_date), 'MMM d, yyyy')} - {format(new Date(period.end_date), 'MMM d, yyyy')}
                        </p>
                        {period.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{period.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(period)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(period.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {dates.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {dates.length} date{dates.length !== 1 ? 's' : ''} selected:
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {dates.map((date: any) => (
                            <div key={date.id} className="flex items-center justify-between text-sm py-1 px-2 bg-muted/50 rounded">
                              <span className="font-medium">
                                {format(new Date(date.date + 'T00:00:00'), 'MMM d, yyyy')}
                              </span>
                              <div className="flex gap-1">
                                {date.periods.map((period: string) => (
                                  <Badge key={period} variant="secondary" className="text-xs capitalize">
                                    {period}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No specific dates selected</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SeasonalAvailabilityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workerId={workerId}
        tenantId={tenantId}
        existingData={editingData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete seasonal availability?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this seasonal availability period. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}