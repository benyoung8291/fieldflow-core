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
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
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