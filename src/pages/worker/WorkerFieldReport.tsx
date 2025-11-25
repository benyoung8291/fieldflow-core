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
    <div className="min-h-screen bg-background pb-20 pt-14">
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 p-4 shadow-sm">{/* Added top-14 offset */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="mb-2 h-10 w-10 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Field Report</h1>
      </div>

      <FieldReportForm
        appointmentId={id}
        customerId={appointment?.service_order?.customer_id}
        locationId={appointment?.service_order?.location_id}
        serviceOrderId={appointment?.service_order?.id}
        onSave={() => navigate(-1)}
      />
    </div>
  );
}