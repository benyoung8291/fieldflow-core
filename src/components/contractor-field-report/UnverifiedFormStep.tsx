import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, AlertCircle, Info, Building2, Camera, Trash2, Clock, PenLine, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useContractorFieldReportDraft } from "@/hooks/useContractorFieldReportDraft";
import { ContractorPhotoUpload } from "./ContractorPhotoUpload";
import SignaturePad from "@/components/worker/SignaturePad";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UnverifiedFormStepProps {
  token: string;
  phone: string;
  onSuccess: (reportNumber: string) => void;
}

export function UnverifiedFormStep({ token, phone, onSuccess }: UnverifiedFormStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  
  const {
    formData,
    updateFormField,
    photoPairs,
    setPhotoPairs,
    lastSaved,
    clearDraft,
    hasDraft,
  } = useContractorFieldReportDraft(token);

  const handleSignatureSave = (signature: string) => {
    updateFormField('signatureData', signature);
    setShowSignaturePad(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.manualLocationEntry.trim() || !formData.contractorName.trim() || !formData.workDescription.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare photo data for submission
      const photos = photoPairs
        .filter(pair => pair.before || pair.after)
        .flatMap((pair, index) => {
          const result = [];
          if (pair.before) {
            result.push({
              type: 'before',
              fileUrl: pair.before.fileUrl,
              fileName: pair.before.fileName,
              notes: pair.before.notes,
              displayOrder: index * 2,
            });
          }
          if (pair.after) {
            result.push({
              type: 'after',
              fileUrl: pair.after.fileUrl,
              fileName: pair.after.fileName,
              notes: pair.after.notes,
              displayOrder: index * 2 + 1,
              pairedWithIndex: pair.before ? index * 2 : null,
            });
          }
          return result;
        });

      const { data, error } = await supabase.functions.invoke("submit-contractor-field-report", {
        body: {
          token,
          phone,
          manualLocationEntry: formData.manualLocationEntry.trim(),
          contractorName: formData.contractorName.trim(),
          reportData: {
            reportDate: formData.reportDate,
            arrivalTime: formData.arrivalTime || null,
            workDescription: formData.workDescription.trim(),
            internalNotes: formData.internalNotes.trim() || null,
            carpetConditionRating: formData.carpetRating,
            hardfloorConditionRating: formData.hardfloorRating,
            flooringState: formData.flooringState.trim() || null,
            swmsCompleted: formData.swmsCompleted,
            testTagCompleted: formData.testTagCompleted,
            equipmentGoodOrder: formData.equipmentGoodOrder,
            problemAreas: formData.problemAreas,
            problemAreasDescription: formData.problemAreas ? formData.problemAreasDescription.trim() : null,
            methodsAttempted: formData.problemAreas ? formData.methodsAttempted.trim() : null,
            incident: formData.incident,
            incidentDescription: formData.incident ? formData.incidentDescription.trim() : null,
            signatureData: formData.signatureData || null,
            signatureName: formData.signatureName.trim() || null,
            photos,
          },
        },
      });

      if (error) throw error;

      if (data.success) {
        clearDraft();
        onSuccess(data.reportNumber);
      } else {
        setError(data.error || "Failed to submit report");
      }
    } catch (err) {
      console.error("Error submitting report:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Info banner */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Your phone number wasn't found in our system. Please enter the customer and location details manually. Our team will review and map your submission.
        </AlertDescription>
      </Alert>

      {/* Draft status bar */}
      {hasDraft && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Save className="h-4 w-4" />
            {lastSaved ? (
              <span>Draft saved {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>Draft detected</span>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Clear Draft
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all your saved progress and start fresh. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearDraft} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear Draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Location Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Location Details
          </CardTitle>
          <CardDescription>
            Enter the customer name and location where you performed the work
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manualLocation">Customer Name / Location *</Label>
            <Input
              id="manualLocation"
              value={formData.manualLocationEntry}
              onChange={(e) => updateFormField('manualLocationEntry', e.target.value)}
              placeholder="e.g., Acme Corp - 123 Main Street, Melbourne"
            />
            <p className="text-xs text-muted-foreground">
              Include as much detail as possible (customer name, site name, address)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Report Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractorName">Your Name *</Label>
              <Input
                id="contractorName"
                value={formData.contractorName}
                onChange={(e) => updateFormField('contractorName', e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportDate">Report Date *</Label>
              <Input
                id="reportDate"
                type="date"
                value={formData.reportDate}
                onChange={(e) => updateFormField('reportDate', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="arrivalTime" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time of Attendance
            </Label>
            <Input
              id="arrivalTime"
              type="time"
              value={formData.arrivalTime}
              onChange={(e) => updateFormField('arrivalTime', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workDescription">Work Description *</Label>
            <Textarea
              id="workDescription"
              value={formData.workDescription}
              onChange={(e) => updateFormField('workDescription', e.target.value)}
              placeholder="Describe the work performed..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internalNotes">Internal Notes</Label>
            <Textarea
              id="internalNotes"
              value={formData.internalNotes}
              onChange={(e) => updateFormField('internalNotes', e.target.value)}
              placeholder="Any internal notes (not shown to customer)..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Before & After Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Before & After Photos
          </CardTitle>
          <CardDescription>
            Document the work with before and after photos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractorPhotoUpload
            token={token}
            initialPairs={photoPairs}
            onPhotosChange={setPhotoPairs}
          />
        </CardContent>
      </Card>

      {/* Condition Ratings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condition Ratings</CardTitle>
          <CardDescription>Rate the condition of flooring (1 = Poor, 5 = Excellent)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Carpet Condition</Label>
              <span className="text-sm font-medium">{formData.carpetRating}/5</span>
            </div>
            <Slider
              value={[formData.carpetRating]}
              onValueChange={([v]) => updateFormField('carpetRating', v)}
              min={1}
              max={5}
              step={1}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Hard Floor Condition</Label>
              <span className="text-sm font-medium">{formData.hardfloorRating}/5</span>
            </div>
            <Slider
              value={[formData.hardfloorRating]}
              onValueChange={([v]) => updateFormField('hardfloorRating', v)}
              min={1}
              max={5}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flooringState">Flooring State Notes</Label>
            <Textarea
              id="flooringState"
              value={formData.flooringState}
              onChange={(e) => updateFormField('flooringState', e.target.value)}
              placeholder="Additional notes about flooring condition..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance & Safety */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compliance & Safety</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="swms" className="cursor-pointer">SWMS Completed</Label>
            <Switch id="swms" checked={formData.swmsCompleted} onCheckedChange={(v) => updateFormField('swmsCompleted', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="testTag" className="cursor-pointer">Test & Tag Completed</Label>
            <Switch id="testTag" checked={formData.testTagCompleted} onCheckedChange={(v) => updateFormField('testTagCompleted', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="equipment" className="cursor-pointer">Equipment in Good Order</Label>
            <Switch id="equipment" checked={formData.equipmentGoodOrder} onCheckedChange={(v) => updateFormField('equipmentGoodOrder', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Issues & Incidents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="problemAreas" className="cursor-pointer">Problem Areas Identified</Label>
              <Switch id="problemAreas" checked={formData.problemAreas} onCheckedChange={(v) => updateFormField('problemAreas', v)} />
            </div>
            {formData.problemAreas && (
              <div className="space-y-3 pl-4 border-l-2 border-muted">
                <Textarea
                  value={formData.problemAreasDescription}
                  onChange={(e) => updateFormField('problemAreasDescription', e.target.value)}
                  placeholder="Describe the problem areas..."
                  rows={3}
                />
                <div className="space-y-2">
                  <Label htmlFor="methodsAttempted">Methods Attempted to Resolve</Label>
                  <Textarea
                    id="methodsAttempted"
                    value={formData.methodsAttempted}
                    onChange={(e) => updateFormField('methodsAttempted', e.target.value)}
                    placeholder="Describe what methods you tried to address the problem..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="incident" className="cursor-pointer">Incident Occurred</Label>
              <Switch id="incident" checked={formData.incident} onCheckedChange={(v) => updateFormField('incident', v)} />
            </div>
            {formData.incident && (
              <Textarea
                value={formData.incidentDescription}
                onChange={(e) => updateFormField('incidentDescription', e.target.value)}
                placeholder="Describe the incident..."
                rows={3}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Customer Signature
          </CardTitle>
          <CardDescription>
            Optional: Capture the customer's signature to confirm work completion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.signatureData ? (
            <div className="space-y-3">
              <div className="border rounded-lg p-4 bg-white">
                <img src={formData.signatureData} alt="Customer signature" className="max-h-32 mx-auto" />
              </div>
              {formData.signatureName && (
                <p className="text-sm text-muted-foreground text-center">
                  Signed by: {formData.signatureName}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSignaturePad(true)}
                className="w-full"
              >
                Update Signature
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signatureName">Customer Name</Label>
                <Input
                  id="signatureName"
                  value={formData.signatureName}
                  onChange={(e) => updateFormField('signatureName', e.target.value)}
                  placeholder="Enter customer's name"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSignaturePad(true)}
                className="w-full"
              >
                <PenLine className="h-4 w-4 mr-2" />
                Capture Signature
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting Report...
          </>
        ) : (
          "Submit Field Report"
        )}
      </Button>

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onClose={() => setShowSignaturePad(false)}
        />
      )}
    </form>
  );
}
