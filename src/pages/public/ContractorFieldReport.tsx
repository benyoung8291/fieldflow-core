import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneEntryStep } from "@/components/contractor-field-report/PhoneEntryStep";
import { VerifiedFormStep } from "@/components/contractor-field-report/VerifiedFormStep";
import { UnverifiedFormStep } from "@/components/contractor-field-report/UnverifiedFormStep";

interface LinkValidation {
  valid: boolean;
  reason?: string;
  tenantId?: string;
  tenantName?: string;
  linkName?: string;
}

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

type Step = "loading" | "invalid" | "phone" | "verified_form" | "unverified_form" | "success";

export default function ContractorFieldReport() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("loading");
  const [linkData, setLinkData] = useState<LinkValidation | null>(null);
  const [phoneData, setPhoneData] = useState<PhoneVerification | null>(null);
  const [phone, setPhone] = useState("");
  const [reportNumber, setReportNumber] = useState("");

  useEffect(() => {
    if (token) {
      validateLink();
    }
  }, [token]);

  const validateLink = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("validate-contractor-link", {
        body: { token },
      });

      if (error) throw error;

      setLinkData(data);
      if (data.valid) {
        setStep("phone");
      } else {
        setStep("invalid");
      }
    } catch (error) {
      console.error("Error validating link:", error);
      setLinkData({ valid: false, reason: "server_error" });
      setStep("invalid");
    }
  };

  const handlePhoneVerified = (data: PhoneVerification, enteredPhone: string) => {
    setPhoneData(data);
    setPhone(enteredPhone);
    if (data.verified) {
      setStep("verified_form");
    } else {
      setStep("unverified_form");
    }
  };

  const handleSubmitSuccess = (reportNum: string) => {
    setReportNumber(reportNum);
    setStep("success");
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "invalid") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Link Invalid</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              {linkData?.reason === "link_expired"
                ? "This link has expired. Please request a new link."
                : linkData?.reason === "link_inactive"
                ? "This link is no longer active. Please contact the administrator."
                : "This link is invalid or has been removed."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Report Submitted</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your field report has been submitted successfully.
            </p>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Report Number</p>
              <p className="text-lg font-semibold">{reportNumber}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              The team will review your submission. You can close this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-8 pb-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{linkData?.tenantName || "Field Report"}</h1>
          <p className="text-muted-foreground">Submit a field report</p>
        </div>

        {step === "phone" && (
          <PhoneEntryStep
            token={token!}
            onVerified={handlePhoneVerified}
          />
        )}

        {step === "verified_form" && phoneData && (
          <VerifiedFormStep
            token={token!}
            phone={phone}
            contactId={phoneData.contactId!}
            contactType={phoneData.contactType!}
            contactName={phoneData.contactName}
            suggestedCustomers={phoneData.suggestedCustomers}
            onSuccess={handleSubmitSuccess}
          />
        )}

        {step === "unverified_form" && (
          <UnverifiedFormStep
            token={token!}
            phone={phone}
            onSuccess={handleSubmitSuccess}
          />
        )}
      </div>
    </div>
  );
}
