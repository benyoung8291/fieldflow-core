import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, AlertCircle, Info, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

interface UnverifiedFormStepProps {
  token: string;
  phone: string;
  onSuccess: (reportNumber: string) => void;
}

export function UnverifiedFormStep({ token, phone, onSuccess }: UnverifiedFormStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [manualLocationEntry, setManualLocationEntry] = useState("");
  const [contractorName, setContractorName] = useState("");
  
  // Form fields
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [workDescription, setWorkDescription] = useState("");
  const [carpetRating, setCarpetRating] = useState([3]);
  const [hardfloorRating, setHardfloorRating] = useState([3]);
  const [flooringState, setFlooringState] = useState("");
  const [swmsCompleted, setSwmsCompleted] = useState(false);
  const [testTagCompleted, setTestTagCompleted] = useState(false);
  const [equipmentGoodOrder, setEquipmentGoodOrder] = useState(true);
  const [problemAreas, setProblemAreas] = useState(false);
  const [problemAreasDescription, setProblemAreasDescription] = useState("");
  const [incident, setIncident] = useState(false);
  const [incidentDescription, setIncidentDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualLocationEntry.trim() || !contractorName.trim() || !workDescription.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke("submit-contractor-field-report", {
        body: {
          token,
          phone,
          manualLocationEntry: manualLocationEntry.trim(),
          contractorName: contractorName.trim(),
          reportData: {
            reportDate,
            workDescription: workDescription.trim(),
            carpetConditionRating: carpetRating[0],
            hardfloorConditionRating: hardfloorRating[0],
            flooringState: flooringState.trim() || null,
            swmsCompleted,
            testTagCompleted,
            equipmentGoodOrder,
            problemAreas,
            problemAreasDescription: problemAreas ? problemAreasDescription.trim() : null,
            incident,
            incidentDescription: incident ? incidentDescription.trim() : null,
          },
        },
      });

      if (error) throw error;

      if (data.success) {
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
              value={manualLocationEntry}
              onChange={(e) => setManualLocationEntry(e.target.value)}
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
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportDate">Report Date *</Label>
              <Input
                id="reportDate"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workDescription">Work Description *</Label>
            <Textarea
              id="workDescription"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              placeholder="Describe the work performed..."
              rows={4}
            />
          </div>
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
              <span className="text-sm font-medium">{carpetRating[0]}/5</span>
            </div>
            <Slider
              value={carpetRating}
              onValueChange={setCarpetRating}
              min={1}
              max={5}
              step={1}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Hard Floor Condition</Label>
              <span className="text-sm font-medium">{hardfloorRating[0]}/5</span>
            </div>
            <Slider
              value={hardfloorRating}
              onValueChange={setHardfloorRating}
              min={1}
              max={5}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="flooringState">Flooring State Notes</Label>
            <Textarea
              id="flooringState"
              value={flooringState}
              onChange={(e) => setFlooringState(e.target.value)}
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
            <Switch id="swms" checked={swmsCompleted} onCheckedChange={setSwmsCompleted} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="testTag" className="cursor-pointer">Test & Tag Completed</Label>
            <Switch id="testTag" checked={testTagCompleted} onCheckedChange={setTestTagCompleted} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="equipment" className="cursor-pointer">Equipment in Good Order</Label>
            <Switch id="equipment" checked={equipmentGoodOrder} onCheckedChange={setEquipmentGoodOrder} />
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
              <Switch id="problemAreas" checked={problemAreas} onCheckedChange={setProblemAreas} />
            </div>
            {problemAreas && (
              <Textarea
                value={problemAreasDescription}
                onChange={(e) => setProblemAreasDescription(e.target.value)}
                placeholder="Describe the problem areas..."
                rows={3}
              />
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="incident" className="cursor-pointer">Incident Occurred</Label>
              <Switch id="incident" checked={incident} onCheckedChange={setIncident} />
            </div>
            {incident && (
              <Textarea
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                placeholder="Describe the incident..."
                rows={3}
              />
            )}
          </div>
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
    </form>
  );
}
