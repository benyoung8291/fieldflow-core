import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ServiceOrderProfitLossCardProps {
  totalRevenue: number;
  actualCost: number;
  costOfMaterials: number;
  costOfLabor: number;
  otherCosts: number;
  profitMargin: number;
}

export default function ServiceOrderProfitLossCard({
  totalRevenue,
  actualCost,
  costOfMaterials,
  costOfLabor,
  otherCosts,
  profitMargin,
}: ServiceOrderProfitLossCardProps) {
  const grossProfit = totalRevenue - actualCost;
  const isPositive = grossProfit >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Profit & Loss
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-muted-foreground">Revenue</span>
            <span className="text-lg font-bold">
              ${totalRevenue.toFixed(2)}
            </span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        {/* Costs Breakdown */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Costs</div>
          
          {/* Materials */}
          <div className="flex justify-between items-center">
            <span className="text-sm">Materials (from POs)</span>
            <span className="text-sm font-medium">
              ${costOfMaterials.toFixed(2)}
            </span>
          </div>
          
          {/* Labor */}
          <div className="flex justify-between items-center">
            <span className="text-sm">Labor (from time logs)</span>
            <span className="text-sm font-medium">
              ${costOfLabor.toFixed(2)}
            </span>
          </div>
          
          {/* Other */}
          {otherCosts > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm">Other Costs</span>
              <span className="text-sm font-medium">
                ${otherCosts.toFixed(2)}
              </span>
            </div>
          )}
          
          {/* Total Costs */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Total Costs</span>
            <span className="text-sm font-bold">
              ${actualCost.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Gross Profit</span>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span 
                className={`text-lg font-bold ${
                  isPositive ? "text-success" : "text-destructive"
                }`}
              >
                ${Math.abs(grossProfit).toFixed(2)}
              </span>
            </div>
          </div>
          
          {/* Profit Margin */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Profit Margin</span>
            <span 
              className={`text-sm font-medium ${
                isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
