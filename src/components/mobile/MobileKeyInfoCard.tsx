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
    <Card className={cn("border-border/50 shadow-sm bg-card", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1 text-primary bg-primary/10 p-2 rounded-xl">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
            <div className="text-base font-semibold break-words">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
