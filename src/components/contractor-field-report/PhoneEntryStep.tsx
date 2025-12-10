import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface PhoneVerification {
  verified: boolean;
  contactType?: "supplier_contact" | "worker";
  contactId?: string;
  contactName?: string;
  supplierName?: string;
  tenantId?: string;
  suggestedCustomers?: { name: string; locations: string[] }[];
  reason?: string;
}

interface PhoneEntryStepProps {
  token: string;
  onVerified: (data: PhoneVerification, phone: string) => void;
}

export function PhoneEntryStep({ token, onVerified }: PhoneEntryStepProps) {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      setError("Please enter your mobile number");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-contractor-phone", {
        body: { token, phone: phone.trim() },
      });

      if (fnError) throw fnError;

      if (data.reason === "rate_limited") {
        setError("Too many attempts. Please wait a minute and try again.");
        return;
      }

      onVerified(data, phone.trim());
    } catch (err) {
      console.error("Error verifying phone:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Enter Your Mobile Number
        </CardTitle>
        <CardDescription>
          Enter your mobile number to continue. If your number is on file, you'll be able to select from available customers and locations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="0400 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Enter your number in any format (e.g., 0400000000, +61 400 000 000)
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
