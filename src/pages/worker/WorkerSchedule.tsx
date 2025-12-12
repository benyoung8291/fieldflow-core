import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Clock, Save } from 'lucide-react';
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/worker/PullToRefreshIndicator';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function WorkerSchedule() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);

  const { containerRef, isRefreshing: isPulling, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadSchedule();
    },
  });

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setWorkerId(user.id);

      const { data } = await supabase
        .from('worker_schedule')
        .select('*')
        .eq('worker_id', user.id)
        .order('day_of_week');

      // Initialize with all days if no schedule exists
      if (!data || data.length === 0) {
        const defaultSchedule = DAYS_OF_WEEK.map((day) => ({
          day_of_week: day.value,
          start_time: '09:00:00',
          end_time: '17:00:00',
          is_active: false,
        }));
        setSchedule(defaultSchedule);
      } else {
        // Ensure all days are represented
        const fullSchedule = DAYS_OF_WEEK.map((day) => {
          const existing = data.find((s) => s.day_of_week === day.value);
          return existing || {
            day_of_week: day.value,
            start_time: '09:00:00',
            end_time: '17:00:00',
            is_active: false,
          };
        });
        setSchedule(fullSchedule);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (dayValue: number) => {
    setSchedule((prev) =>
      prev.map((s) =>
        s.day_of_week === dayValue ? { ...s, is_active: !s.is_active } : s
      )
    );
  };

  const handleTimeChange = (dayValue: number, field: 'start_time' | 'end_time', value: string) => {
    setSchedule((prev) =>
      prev.map((s) =>
        s.day_of_week === dayValue ? { ...s, [field]: `${value}:00` } : s
      )
    );
  };

  const handleSave = async () => {
    if (!workerId) return;

    setSaving(true);
    try {
      // Delete existing schedule
      await supabase.from('worker_schedule').delete().eq('worker_id', workerId);

      // Get tenant_id using RPC function (bypasses RLS)
      const { data: tenantId, error: tenantError } = await supabase
        .rpc('get_user_tenant_id');

      if (tenantError || !tenantId) throw new Error('Tenant not found');

      // Insert active days only
      const activeSchedule = schedule
        .filter((s) => s.is_active)
        .map((s) => ({
          worker_id: workerId,
          tenant_id: tenantId,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          is_active: true,
        }));

      if (activeSchedule.length > 0) {
        const { error } = await supabase.from('worker_schedule').insert(activeSchedule);
        if (error) throw error;
      }

      toast.success('Schedule saved successfully');
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-background pb-20">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPulling} />
      <WorkerHeader title="My Schedule" showBack />

      <div className="px-4 pt-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedule = schedule.find((s) => s.day_of_week === day.value);
              if (!daySchedule) return null;

              return (
                <div key={day.value} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{day.label}</Label>
                    <Switch
                      checked={daySchedule.is_active}
                      onCheckedChange={() => handleToggleDay(day.value)}
                    />
                  </div>
                  {daySchedule.is_active && (
                    <div className="flex gap-2 pl-4">
                      <div className="flex-1">
                        <Label className="text-[11px] text-muted-foreground">Start Time</Label>
                        <Input
                          type="time"
                          value={daySchedule.start_time?.slice(0, 5) || '09:00'}
                          onChange={(e) =>
                            handleTimeChange(day.value, 'start_time', e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-[11px] text-muted-foreground">End Time</Label>
                        <Input
                          type="time"
                          value={daySchedule.end_time?.slice(0, 5) || '17:00'}
                          onChange={(e) =>
                            handleTimeChange(day.value, 'end_time', e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>
    </div>
  );
}
