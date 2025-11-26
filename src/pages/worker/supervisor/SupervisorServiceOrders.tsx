import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SupervisorServiceOrders() {
  const navigate = useNavigate();
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadServiceOrders();
  }, [statusFilter]);

  const loadServiceOrders = async () => {
    try {
      let query = supabase
        .from('service_orders')
        .select(`
          *,
          customer:customers(name, phone, address),
          project:projects(name, project_number)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;

      setServiceOrders(data || []);
    } catch (error) {
      console.error('Error loading service orders:', error);
      toast.error('Failed to load service orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'scheduled':
        return 'bg-yellow-500';
      case 'pending':
        return 'bg-orange-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/worker/supervisor/dashboard')}
              className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Service Orders</h1>
              <p className="text-xs opacity-90">{serviceOrders.length} total</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* Status Filter */}
        <Card>
          <CardContent className="p-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="in_progress">Active</TabsTrigger>
                <TabsTrigger value="completed">Done</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Service Orders List */}
        {loading ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : serviceOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">
                No service orders found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {serviceOrders.map((so) => (
              <Card
                key={so.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/service-orders/${so.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{so.work_order_number}</h3>
                        {so.priority && (
                          <Badge variant="outline" className="text-xs">
                            {so.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {so.customer?.name}
                      </p>
                      {so.project && (
                        <p className="text-xs text-muted-foreground">
                          Project: {so.project.name}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(so.status)}>
                      {so.status?.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    {so.preferred_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs">
                          {format(parseISO(so.preferred_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}

                    {so.customer?.address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span className="text-xs">{so.customer.address}</span>
                      </div>
                    )}

                    {so.total_value && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          ${parseFloat(so.total_value).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {so.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {so.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
