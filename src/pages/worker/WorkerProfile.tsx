import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, User, Briefcase, Mail, Phone, Save } from 'lucide-react';
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/worker/PullToRefreshIndicator';
import { APP_VERSION } from '@/lib/version';

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface WorkerData {
  pay_rate_category_id: string | null;
  preferred_days: string[] | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
}

export default function WorkerProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [worker, setWorker] = useState<WorkerData | null>(null);

  const { containerRef, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: loadData,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/worker/auth');
        return;
      }

      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get worker data
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('pay_rate_category_id, preferred_days, preferred_start_time, preferred_end_time')
        .eq('id', user.id)
        .single();

      if (workerError) throw workerError;

      setProfile(profileData as ProfileData);
      setWorker(workerData);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div ref={containerRef} className="min-h-screen bg-background pb-20">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/worker/dashboard')}
              className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs font-medium opacity-90">Settings</p>
              <h1 className="text-base font-bold">My Profile</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 pb-20">
        {/* Personal Information */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription className="text-sm">Your basic profile details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-sm font-medium">First Name</Label>
                <Input
                  id="first_name"
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="last_name"
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email (Read Only)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="h-10 pl-10 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="h-10 pl-10"
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worker Preferences (Read Only) */}
        {worker && (
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Work Preferences</CardTitle>
                  <CardDescription className="text-sm">Read-only settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {worker.preferred_days && worker.preferred_days.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Preferred Days</Label>
                  <div className="h-auto min-h-[36px] px-3 py-2 flex items-center bg-muted rounded-md text-sm">
                    {worker.preferred_days.join(', ')}
                  </div>
                </div>
              )}

              {(worker.preferred_start_time || worker.preferred_end_time) && (
                <div className="grid grid-cols-2 gap-3">
                  {worker.preferred_start_time && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Preferred Start</Label>
                      <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                        {worker.preferred_start_time}
                      </div>
                    </div>
                  )}
                  {worker.preferred_end_time && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Preferred End</Label>
                      <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm">
                        {worker.preferred_end_time}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Emergency Contact */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">Emergency Contact</CardTitle>
                <CardDescription className="text-sm">In case of emergency</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="emergency_name" className="text-sm font-medium">Contact Name</Label>
              <Input
                id="emergency_name"
                value={profile.emergency_contact_name || ''}
                onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                className="h-10"
                placeholder="Emergency contact name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency_phone" className="text-sm font-medium">Contact Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="emergency_phone"
                  value={profile.emergency_contact_phone || ''}
                  onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })}
                  className="h-10 pl-10"
                  placeholder="Emergency contact phone"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 text-base font-semibold shadow-sm"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>

        {/* Version Footer */}
        <div className="flex items-center justify-center pt-4 text-xs text-muted-foreground/50">
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
