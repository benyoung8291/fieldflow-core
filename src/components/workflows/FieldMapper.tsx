import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface FieldMapperProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  availableFields: Record<string, any>;
  placeholder?: string;
}

export default function FieldMapper({
  label,
  value,
  onChange,
  availableFields,
  placeholder,
}: FieldMapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  const flattenFields = (obj: Record<string, any>, prefix = ""): string[] => {
    const fields: string[] = [];
    
    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (val && typeof val === "object" && !Array.isArray(val)) {
        fields.push(path);
        fields.push(...flattenFields(val, path));
      } else {
        fields.push(path);
      }
    }
    
    return fields;
  };

  const allFields = Object.keys(availableFields).length > 0 
    ? flattenFields(availableFields)
    : [];

  const insertField = (fieldPath: string) => {
    const newValue = value ? `${value} {{${fieldPath}}}` : `{{${fieldPath}}}`;
    onChange(newValue);
    setIsOpen(false);
  };

  const hasMapping = value.includes("{{") && value.includes("}}");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {allFields.length > 0 && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Insert Data
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Select a field from the trigger data:
                </p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {allFields.map((field) => (
                    <button
                      key={field}
                      onClick={() => insertField(field)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-sm flex items-center justify-between group"
                    >
                      <span className="font-mono text-xs">{field}</span>
                      <Badge variant="secondary" className="text-xs opacity-0 group-hover:opacity-100">
                        Insert
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Enter value or use {{field}} for dynamic data"}
          className={hasMapping ? "border-primary/50" : ""}
        />
        {hasMapping && (
          <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">
            Mapped
          </Badge>
        )}
      </div>
      {hasMapping && (
        <p className="text-xs text-muted-foreground">
          Data will be dynamically inserted when workflow runs
        </p>
      )}
    </div>
  );
}
