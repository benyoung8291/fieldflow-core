import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SkillsMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function SkillsMultiSelect({ value, onChange }: SkillsMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: skills = [] } = useQuery({
    queryKey: ["skills-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const selectedSkills = skills.filter((skill: any) => value.includes(skill.id));

  const toggleSkill = (skillId: string) => {
    if (value.includes(skillId)) {
      onChange(value.filter((id) => id !== skillId));
    } else {
      onChange([...value, skillId]);
    }
  };

  const removeSkill = (skillId: string) => {
    onChange(value.filter((id) => id !== skillId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value.length > 0
              ? `${value.length} skill${value.length > 1 ? "s" : ""} selected`
              : "Select skills..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search skills..." />
            <CommandEmpty>No skills found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {skills.map((skill: any) => (
                <CommandItem
                  key={skill.id}
                  value={skill.id}
                  onSelect={() => toggleSkill(skill.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(skill.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{skill.name}</div>
                    {skill.category && (
                      <div className="text-xs text-muted-foreground">
                        {skill.category}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSkills.map((skill: any) => (
            <Badge
              key={skill.id}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => removeSkill(skill.id)}
            >
              {skill.name}
              <span className="ml-1 text-muted-foreground hover:text-foreground">
                ×
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
