import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, AlertCircle, MapPin, Building2, Camera, Trash2, Clock, PenLine, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useContractorFieldReportDraft, PhotoPair } from "@/hooks/useContractorFieldReportDraft";
import { ContractorPhotoUpload } from "./ContractorPhotoUpload";
import { ConditionRatingSlider } from "./ConditionRatingSlider";
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

interface VerifiedFormStepProps {
  token: string;
  phone: string;
  contactId: string;
  contactType: "supplier_contact" | "worker";
  contactName?: string;
  suggestedCustomers?: { name: string; locations: string[] }[];
  onSuccess: (reportNumber: string) => void;
}

interface CustomerData {
  suggested: { name: string }[];
  all: { name: string }[];
}

interface LocationData {
  suggested: { name: string }[];
  all: { name: string }[];
}

export function VerifiedFormStep({
  token,
  phone,
  contactId,
  contactType,
  contactName,
  onSuccess,
}: VerifiedFormStepProps) {
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  
  const [customers, setCustomers] = useState<CustomerData>({ suggested: [], all: [] });
  const [locations, setLocations] = useState<LocationData>({ suggested: [], all: [] });
  
  const {
    formData,
    updateFormField,
    photoPairs,
    setPhotoPairs,
    lastSaved,
    clearDraft,
    hasDraft,
  } = useContractorFieldReportDraft(token, contactName);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (formData.selectedCustomer) {
      loadLocations(formData.selectedCustomer);
    } else {
      setLocations({ suggested: [], all: [] });
      updateFormField('selectedLocation', '');
    }
  }, [formData.selectedCustomer]);

  const loadCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-contractor-customers", {
        body: { token, phone, contactId, contactType },
      });

      if (error) throw error;
      setCustomers(data);
    } catch (err) {
      console.error("Error loading customers:", err);
      setError("Failed to load customers. Please try again.");
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const loadLocations = async (customerName: string) => {
    setIsLoadingLocations(true);
    updateFormField('selectedLocation', '');
    try {
      const { data, error } = await supabase.functions.invoke("get-contractor-locations", {
        body: { token, phone, contactId, contactType, customerName },
      });

      if (error) throw error;
      setLocations(data);
    } catch (err) {
      console.error("Error loading locations:", err);
      setError("Failed to load locations. Please try again.");
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const handleSignatureSave = (signature: string) => {
    updateFormField('signatureData', signature);
    setShowSignaturePad(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.selectedCustomer || !formData.selectedLocation || !formData.contractorName.trim() || !formData.workDescription.trim()) {
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
          contactId,
          contactType,
          customerName: formData.selectedCustomer,
          locationName: formData.selectedLocation,
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

  const allCustomers = [...customers.suggested, ...customers.all];
  const allLocations = [...locations.suggested, ...locations.all];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header with draft status and clear button */}
      <div className="flex items-center justify-between">
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 flex-1">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Phone verified{contactName ? ` - Welcome, ${contactName}` : ""}
          </AlertDescription>
        </Alert>
      </div>

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

      {/* Customer & Location Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Location Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            {isLoadingCustomers ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading customers...
              </div>
            ) : (
              <Select value={formData.selectedCustomer} onValueChange={(v) => updateFormField('selectedCustomer', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.suggested.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Suggested
                      </div>
                      {customers.suggested.map((c) => (
                        <SelectItem key={`suggested-${c.name}`} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                      {customers.all.length > 0 && <Separator className="my-1" />}
                    </>
                  )}
                  {customers.all.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        All Customers
                      </div>
                      {customers.all.map((c) => (
                        <SelectItem key={`all-${c.name}`} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {allCustomers.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No customers available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            {isLoadingLocations ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading locations...
              </div>
            ) : !formData.selectedCustomer ? (
              <p className="text-sm text-muted-foreground py-2">
                Select a customer first
              </p>
            ) : (
              <Select value={formData.selectedLocation} onValueChange={(v) => updateFormField('selectedLocation', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.suggested.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Suggested
                      </div>
                      {locations.suggested.map((l) => (
                        <SelectItem key={`suggested-${l.name}`} value={l.name}>
                          {l.name}
                        </SelectItem>
                      ))}
                      {locations.all.length > 0 && <Separator className="my-1" />}
                    </>
                  )}
                  {locations.all.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        All Locations
                      </div>
                      {locations.all.map((l) => (
                        <SelectItem key={`all-${l.name}`} value={l.name}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {allLocations.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No locations available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
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
          <ConditionRatingSlider
            label="Carpet Condition"
            value={formData.carpetRating}
            onChange={(v) => updateFormField('carpetRating', v)}
          />

          <ConditionRatingSlider
            label="Hard Floor Condition"
            value={formData.hardfloorRating}
            onChange={(v) => updateFormField('hardfloorRating', v)}
          />

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
