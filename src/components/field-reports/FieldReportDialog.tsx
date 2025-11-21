import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FieldReportForm from './FieldReportForm';

interface FieldReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId?: string;
  customerId?: string;
  locationId?: string;
  serviceOrderId?: string;
}

export default function FieldReportDialog({
  open,
  onOpenChange,
  appointmentId,
  customerId,
  locationId,
  serviceOrderId,
}: FieldReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Field Report</DialogTitle>
        </DialogHeader>
        <FieldReportForm
          appointmentId={appointmentId}
          customerId={customerId}
          locationId={locationId}
          serviceOrderId={serviceOrderId}
          onSave={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}