import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Edit, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

interface FieldReportsListProps {
  appointmentId: string;
  onReportStateChange?: () => void;
}

export default function FieldReportsList({ appointmentId, onReportStateChange }: FieldReportsListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: fieldReports = [], isLoading } = useQuery({
    queryKey: ['field-reports', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_reports')
        .select(`
          *,
          profiles:created_by (
            first_name,
            last_name
          )
        `)
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading field reports...
      </div>
    );
  }

  const handleDeleteClick = (report: any) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return;

    setIsDeleting(true);
    try {
      // Delete field report photos first
      const { error: photosError } = await supabase
        .from('field_report_photos')
        .delete()
        .eq('field_report_id', reportToDelete.id);

      if (photosError) throw photosError;

      // Delete the field report
      const { error: reportError } = await supabase
        .from('field_reports')
        .delete()
        .eq('id', reportToDelete.id);

      if (reportError) throw reportError;

      toast.success('Draft deleted successfully');
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['field-reports', appointmentId] });
      onReportStateChange?.();
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      toast.error(error.message || 'Failed to delete draft');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  if (fieldReports.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No field reports yet</p>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this draft field report? This action cannot be undone.
              {reportToDelete && (
                <div className="mt-2 font-medium text-foreground">
                  Report: {reportToDelete.report_number}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    <div className="space-y-3">
      {fieldReports.map((report: any) => {
        const isCreator = currentUser?.id === report.created_by;
        const isLocked = report.approved_at && report.pdf_url;
        const canEdit = isCreator && !isLocked;
        const isDraft = report.status === 'draft';
        const canDelete = isCreator && isDraft;

        return (
          <Card key={report.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{report.report_number}</h4>
                    <Badge 
                      variant={report.status === 'submitted' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {report.status}
                    </Badge>
                    {isLocked && (
                      <Badge variant="outline" className="text-xs">
                        Approved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    By {report.profiles?.first_name} {report.profiles?.last_name}
                  </p>
                  {report.created_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                  {report.submitted_at && (
                    <p className="text-xs text-muted-foreground">
                      Submitted: {format(new Date(report.submitted_at), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/worker/field-report/${appointmentId}/edit/${report.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(report)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/worker/field-report/${appointmentId}/view/${report.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
    </>
  );
}
