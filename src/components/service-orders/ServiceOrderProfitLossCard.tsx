import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

interface ServiceOrderProfitLossCardProps {
  totalRevenue: number;
  actualCost: number;
  costOfMaterials: number;
  costOfLabor: number;
  otherCosts?: number;
  profitMargin?: number;
  pendingPOCosts?: number;
  apInvoiceCosts?: number;
  estimatedLaborCost?: number;
}

export default function ServiceOrderProfitLossCard({
  totalRevenue,
  actualCost,
  costOfMaterials,
  costOfLabor,
  otherCosts = 0,
  profitMargin,
  pendingPOCosts = 0,
  apInvoiceCosts = 0,
  estimatedLaborCost = 0,
}: ServiceOrderProfitLossCardProps) {
  const grossProfit = totalRevenue - actualCost;
  const isPositive = grossProfit >= 0;
  const calculatedMargin = profitMargin ?? (totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0);

  return (
    <div className="bg-card border rounded-lg p-2.5">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm">Profit & Loss</span>
      </div>
      <div className="space-y-3">
        {/* Revenue */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-muted-foreground">Revenue</span>
            <span className="text-sm font-bold">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <Progress value={100} className="h-1.5" />
        </div>

        {/* Costs Breakdown */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Costs</div>
          
          {/* Materials */}
          <div className="flex justify-between items-center">
            <span className="text-xs">Materials</span>
            <span className="text-xs font-medium">
              {formatCurrency(costOfMaterials)}
            </span>
          </div>
          
          {/* Labor */}
          <div className="flex justify-between items-center">
            <span className="text-xs">Labor</span>
            <span className="text-xs font-medium">
              {formatCurrency(costOfLabor)}
            </span>
          </div>
          
          {/* Estimated Labor */}
          {estimatedLaborCost > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs">Est. Labor</span>
              <span className="text-xs font-medium">
                {formatCurrency(estimatedLaborCost)}
              </span>
            </div>
          )}
          
          {/* AP Invoice Costs */}
          {apInvoiceCosts > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs">AP Invoices</span>
              <span className="text-xs font-medium">
                {formatCurrency(apInvoiceCosts)}
              </span>
            </div>
          )}
          
          {/* Other */}
          {otherCosts > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs">Other</span>
              <span className="text-xs font-medium">
                {formatCurrency(otherCosts)}
              </span>
            </div>
          )}
          
          {/* Pending PO Costs */}
          {pendingPOCosts > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Pending</span>
              <span className="text-xs font-medium text-muted-foreground">
                {formatCurrency(pendingPOCosts)}
              </span>
            </div>
          )}
          
          {/* Total Costs */}
          <div className="flex justify-between items-center pt-1.5 border-t">
            <span className="text-xs font-medium">Total</span>
            <span className="text-xs font-bold">
              {formatCurrency(actualCost)}
            </span>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium">Gross Profit</span>
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span 
                className={`text-sm font-bold ${
                  isPositive ? "text-success" : "text-destructive"
                }`}
              >
                {formatCurrency(Math.abs(grossProfit))}
              </span>
            </div>
          </div>
          
          {/* Profit Margin */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Margin</span>
            <span 
              className={`text-xs font-medium ${
                isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {calculatedMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
