import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MobileKeyInfoCardProps {
  icon: ReactNode;
  label: string;
  value: string | ReactNode;
  className?: string;
}

export const MobileKeyInfoCard = ({
  icon,
  label,
  value,
  className,
}: MobileKeyInfoCardProps) => {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <div className="text-sm font-medium break-words">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
