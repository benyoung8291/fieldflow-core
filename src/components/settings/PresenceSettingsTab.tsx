import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function PresenceSettingsTab() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoAwayMinutes, setAutoAwayMinutes] = useState<number>(5);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('auto_away_minutes')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile?.auto_away_minutes) {
        setAutoAwayMinutes(profile.auto_away_minutes);
      }
    } catch (error) {
      console.error('Error fetching presence settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (autoAwayMinutes < 1 || autoAwayMinutes > 60) {
      toast.error('Auto-away timeout must be between 1 and 60 minutes');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ auto_away_minutes: autoAwayMinutes })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Presence settings saved successfully');
    } catch (error) {
      console.error('Error saving presence settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Presence & Activity Settings</CardTitle>
          <CardDescription>
            Configure how your presence and activity status is displayed to other users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auto-away">Auto-Away Timeout (minutes)</Label>
              <div className="flex gap-4 items-end">
                <div className="flex-1 max-w-xs">
                  <Input
                    id="auto-away"
                    type="number"
                    min="1"
                    max="60"
                    value={autoAwayMinutes}
                    onChange={(e) => setAutoAwayMinutes(Number(e.target.value))}
                    placeholder="Enter minutes"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Your status will automatically change to "Away" after this many minutes of inactivity (1-60 minutes)
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Status Indicators</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-muted-foreground">Available - You are actively working</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">Busy - Do not disturb</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Away - Inactive or offline</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">How it Works</h4>
              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>Your status can be manually changed from the presence panel in the header</li>
                <li>When set to "Busy", you will not automatically change to "Away"</li>
                <li>When set to "Away" automatically due to inactivity, you'll return to "Available" when you become active again</li>
                <li>Other users can see your current status and what page you're viewing</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            <Button variant="outline" onClick={fetchSettings} disabled={saving}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
