import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldReportForm from '@/components/field-reports/FieldReportForm';

export default function WorkerFieldReportStandalone() {
  const navigate = useNavigate();
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string | undefined>();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | undefined>();
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [locationId, setLocationId] = useState<string | undefined>();

  const { data: serviceOrders } = useQuery({
    queryKey: ['worker-service-orders'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          id,
          work_order_number,
          title,
          customer_id,
          location_id,
          customers(name),
          customer_locations(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ['worker-appointments'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          title,
          start_time,
          service_order:service_orders(
            id,
            customer_id,
            location_id
          )
        `)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const handleServiceOrderChange = (value: string) => {
    setSelectedServiceOrderId(value);
    setSelectedAppointmentId(undefined);
    
    const serviceOrder = serviceOrders?.find(so => so.id === value);
    if (serviceOrder) {
      setCustomerId(serviceOrder.customer_id);
      setLocationId(serviceOrder.location_id);
    }
  };

  const handleAppointmentChange = (value: string) => {
    setSelectedAppointmentId(value);
    setSelectedServiceOrderId(undefined);
    
    const appointment = appointments?.find(apt => apt.id === value);
    if (appointment?.service_order) {
      setSelectedServiceOrderId(appointment.service_order.id);
      setCustomerId(appointment.service_order.customer_id);
      setLocationId(appointment.service_order.location_id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
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
          <h1 className="text-lg font-bold">Create Field Report</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <Label>Link to Service Order (Optional)</Label>
          <Select value={selectedServiceOrderId} onValueChange={handleServiceOrderChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select service order..." />
            </SelectTrigger>
            <SelectContent>
              {serviceOrders?.map((so) => (
                <SelectItem key={so.id} value={so.id}>
                  {so.work_order_number} - {so.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Link to Appointment (Optional)</Label>
          <Select value={selectedAppointmentId} onValueChange={handleAppointmentChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select appointment..." />
            </SelectTrigger>
            <SelectContent>
              {appointments?.map((apt) => (
                <SelectItem key={apt.id} value={apt.id}>
                  {apt.title} - {new Date(apt.start_time).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FieldReportForm
        appointmentId={selectedAppointmentId}
        customerId={customerId}
        locationId={locationId}
        serviceOrderId={selectedServiceOrderId}
        onSave={() => navigate('/worker/dashboard')}
      />
    </div>
  );
}
