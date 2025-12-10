import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, CheckCircle2, AlertCircle, MapPin, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

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
  
  const [customers, setCustomers] = useState<CustomerData>({ suggested: [], all: [] });
  const [locations, setLocations] = useState<LocationData>({ suggested: [], all: [] });
  
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [contractorName, setContractorName] = useState(contactName || "");
  
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

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadLocations(selectedCustomer);
    } else {
      setLocations({ suggested: [], all: [] });
      setSelectedLocation("");
    }
  }, [selectedCustomer]);

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
    setSelectedLocation("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomer || !selectedLocation || !contractorName.trim() || !workDescription.trim()) {
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
          contactId,
          contactType,
          customerName: selectedCustomer,
          locationName: selectedLocation,
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

  const allCustomers = [...customers.suggested, ...customers.all];
  const allLocations = [...locations.suggested, ...locations.all];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Verified badge */}
      <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          Phone verified{contactName ? ` - Welcome, ${contactName}` : ""}
        </AlertDescription>
      </Alert>

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
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
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
            ) : !selectedCustomer ? (
              <p className="text-sm text-muted-foreground py-2">
                Select a customer first
              </p>
            ) : (
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
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
