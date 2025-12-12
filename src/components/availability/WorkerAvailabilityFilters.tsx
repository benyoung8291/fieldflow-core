import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectWithSearch } from "@/components/ui/select-with-search";

const AUSTRALIAN_STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
  worker_state: string | null;
}

interface WorkerAvailabilityFiltersProps {
  workers: Worker[];
  selectedStates: string[];
  setSelectedStates: (states: string[]) => void;
  selectedWorkerIds: string[];
  setSelectedWorkerIds: (ids: string[]) => void;
}

export function WorkerAvailabilityFilters({
  workers,
  selectedStates,
  setSelectedStates,
  selectedWorkerIds,
  setSelectedWorkerIds,
}: WorkerAvailabilityFiltersProps) {
  const toggleState = (state: string) => {
    if (selectedStates.includes(state)) {
      setSelectedStates(selectedStates.filter(s => s !== state));
    } else {
      setSelectedStates([...selectedStates, state]);
    }
  };

  const toggleWorker = (workerId: string) => {
    if (selectedWorkerIds.includes(workerId)) {
      setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== workerId));
    } else {
      setSelectedWorkerIds([...selectedWorkerIds, workerId]);
    }
  };

  const clearFilters = () => {
    setSelectedStates([]);
    setSelectedWorkerIds([]);
  };

  const hasActiveFilters = selectedStates.length > 0 || selectedWorkerIds.length > 0;

  const workerOptions = workers.map(w => ({
    value: w.id,
    label: `${w.first_name} ${w.last_name}${w.worker_state ? ` (${w.worker_state})` : ""}`,
  }));

  const selectedWorkerNames = selectedWorkerIds.map(id => {
    const worker = workers.find(w => w.id === id);
    return worker ? `${worker.first_name} ${worker.last_name.charAt(0)}.` : "";
  }).filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg">
      {/* State Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">States:</span>
        <div className="flex flex-wrap gap-1">
          {AUSTRALIAN_STATES.map(state => (
            <Badge
              key={state}
              variant={selectedStates.includes(state) ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/80 transition-colors"
              onClick={() => toggleState(state)}
            >
              {state}
            </Badge>
          ))}
        </div>
      </div>

      {/* Worker Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Workers:</span>
        <SelectWithSearch
          value=""
          onValueChange={(value) => {
            if (value && !selectedWorkerIds.includes(value)) {
              toggleWorker(value);
            }
          }}
          options={workerOptions.filter(o => !selectedWorkerIds.includes(o.value))}
          placeholder="Add worker..."
          searchPlaceholder="Search workers..."
        />
      </div>

      {/* Selected Workers */}
      {selectedWorkerNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedWorkerIds.map(id => {
            const worker = workers.find(w => w.id === id);
            if (!worker) return null;
            return (
              <Badge
                key={id}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {worker.first_name} {worker.last_name.charAt(0)}.
                <X
                  className="h-3 w-3 cursor-pointer hover:text-destructive"
                  onClick={() => toggleWorker(id)}
                />
              </Badge>
            );
          })}
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
