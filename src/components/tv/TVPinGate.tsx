import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Loader2, Tv, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TV_SESSION_KEY = "tv_dashboard_session";

interface TVPinGateProps {
  children: React.ReactNode;
}

export function TVPinGate({ children }: TVPinGateProps) {
  const [isValidated, setIsValidated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  // Check for existing session on mount
  useEffect(() => {
    try {
      const session = localStorage.getItem(TV_SESSION_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.valid && parsed.pin) {
          setIsValidated(true);
        }
      }
    } catch {
      // Invalid session, require re-authentication
    }
    setIsLoading(false);
  }, []);

  const validatePin = async () => {
    if (pin.length !== 4) {
      setError("Please enter a 4-digit PIN");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("validate-tv-pin", {
        body: { pin },
      });

      if (fnError) {
        console.error("PIN validation error:", fnError);
        setError("Unable to validate PIN. Please try again.");
        return;
      }

      if (data?.valid) {
        // Store both validation status and PIN for subsequent API calls
        localStorage.setItem(TV_SESSION_KEY, JSON.stringify({ valid: true, pin }));
        setIsValidated(true);
      } else {
        setError("Invalid PIN. Please try again.");
        setPin("");
      }
    } catch (err) {
      console.error("PIN validation error:", err);
      setError("Unable to validate PIN. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  // Handle Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && pin.length === 4 && !isValidating) {
        validatePin();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, isValidating]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isValidated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo/Title */}
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Tv className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Worker Availability</h1>
            <p className="text-muted-foreground mt-1">TV Dashboard</p>
          </div>
        </div>

        {/* PIN Entry */}
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">Enter access PIN to continue</p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={4}
                value={pin}
                onChange={(value) => {
                  setPin(value);
                  setError("");
                }}
                disabled={isValidating}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-14 h-14 text-xl" />
                  <InputOTPSlot index={1} className="w-14 h-14 text-xl" />
                  <InputOTPSlot index={2} className="w-14 h-14 text-xl" />
                  <InputOTPSlot index={3} className="w-14 h-14 text-xl" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={validatePin}
            disabled={pin.length !== 4 || isValidating}
            className="w-full max-w-xs"
            size="lg"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Validating...
              </>
            ) : (
              "Access Dashboard"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
