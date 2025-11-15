import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KeyInfoCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  iconColor?: string;
}

export default function KeyInfoCard({
  icon: Icon,
  label,
  value,
  description,
  iconColor = "text-primary",
}: KeyInfoCardProps) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-7 w-7 ${iconColor}`} />
          <div>
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {description}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
