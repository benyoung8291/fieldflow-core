import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';

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

      // Get tenant_id from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', workerId)
        .single();

      if (!profile?.tenant_id) throw new Error('Tenant not found');

      // Insert active days only
      const activeSchedule = schedule
        .filter((s) => s.is_active)
        .map((s) => ({
          worker_id: workerId,
          tenant_id: profile.tenant_id,
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
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/worker/dashboard')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Schedule</h1>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedule = schedule.find((s) => s.day_of_week === day.value);
              if (!daySchedule) return null;

              return (
                <div key={day.value} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">{day.label}</Label>
                    <Switch
                      checked={daySchedule.is_active}
                      onCheckedChange={() => handleToggleDay(day.value)}
                    />
                  </div>
                  {daySchedule.is_active && (
                    <div className="flex gap-3 pl-4">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Start Time</Label>
                        <Input
                          type="time"
                          value={daySchedule.start_time?.slice(0, 5) || '09:00'}
                          onChange={(e) =>
                            handleTimeChange(day.value, 'start_time', e.target.value)
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">End Time</Label>
                        <Input
                          type="time"
                          value={daySchedule.end_time?.slice(0, 5) || '17:00'}
                          onChange={(e) =>
                            handleTimeChange(day.value, 'end_time', e.target.value)
                          }
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
          size="lg"
          className="w-full"
        >
          <Save className="h-5 w-5 mr-2" />
          {saving ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>
    </div>
  );
}
