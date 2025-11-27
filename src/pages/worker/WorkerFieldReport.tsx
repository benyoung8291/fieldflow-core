import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FieldReportForm from '@/components/field-reports/FieldReportForm';

export default function WorkerFieldReport() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: appointment } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          service_order:service_orders(id, customer_id, location_id)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold">Field Report</h1>
        </div>
      </header>

      <FieldReportForm
        appointmentId={id}
        customerId={appointment?.service_order?.customer_id}
        locationId={appointment?.service_order?.location_id}
        serviceOrderId={appointment?.service_order?.id}
        onSave={() => navigate(`/worker/appointments/${id}`)}
      />
    </div>
  );
}