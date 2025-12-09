import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUSTRALIAN_STATES } from "@/lib/constants/australianStates";

interface StateFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
}

export function StateFilter({ value, onChange, className, triggerClassName }: StateFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={triggerClassName}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="All States" />
        </div>
      </SelectTrigger>
      <SelectContent className={className}>
        <SelectItem value="all">All States</SelectItem>
        {AUSTRALIAN_STATES.map((state) => (
          <SelectItem key={state.value} value={state.value}>
            {state.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
