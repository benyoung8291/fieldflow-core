import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";

interface LineItem {
  id?: string;
  description: string;
  quantity: string;
  cost_price: string;
  margin_percentage: string;
  sell_price: string;
  line_total: number;
  parent_line_item_id?: string;
  subItems?: LineItem[];
  expanded?: boolean;
}

interface InlineQuoteLineItemsProps {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
  defaultMarginPercentage?: number;
}

export default function InlineQuoteLineItems({ lineItems, onChange, readOnly = false, defaultMarginPercentage = 30 }: InlineQuoteLineItemsProps) {
  const [updatedFields, setUpdatedFields] = useState<Record<string, boolean>>({});

  const clearUpdatedField = (key: string) => {
    setTimeout(() => {
      setUpdatedFields(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }, 600);
  };

  const calculateAggregatedValues = (item: LineItem) => {
    if (item.subItems && item.subItems.length > 0) {
      const totalCost = item.subItems.reduce((sum, sub) => {
        const qty = parseFloat(sub.quantity) || 0;
        const cost = parseFloat(sub.cost_price) || 0;
        return sum + (qty * cost);
      }, 0);
      
      const totalSell = item.subItems.reduce((sum, sub) => {
        const qty = parseFloat(sub.quantity) || 0;
        const sell = parseFloat(sub.sell_price) || 0;
        return sum + (qty * sell);
      }, 0);
      
      const margin = totalCost > 0 ? ((totalSell - totalCost) / totalCost) * 100 : 0;
      
      return {
        cost: totalCost,
        sell: totalSell,
        margin: margin,
      };
    }
    
    return {
      cost: parseFloat(item.cost_price) || 0,
      sell: parseFloat(item.sell_price) || 0,
      margin: parseFloat(item.margin_percentage) || 0,
    };
  };

  const calculateLineTotal = (item: LineItem): number => {
    const qty = parseFloat(item.quantity) || 0;
    
    if (item.subItems && item.subItems.length > 0) {
      const subTotal = item.subItems.reduce((sum, sub) => {
        const subQty = parseFloat(sub.quantity) || 0;
        const subSell = parseFloat(sub.sell_price) || 0;
        return sum + (subQty * subSell);
      }, 0);
      return subTotal;
    }
    
    const sell = parseFloat(item.sell_price) || 0;
    return qty * sell;
  };

  const calculatePricing = (field: string, value: string, item: LineItem) => {
    const quantity = field === "quantity" ? value : item.quantity;
    const cost = field === "cost_price" ? value : item.cost_price;
    const margin = field === "margin_percentage" ? value : item.margin_percentage;
    const sell = field === "sell_price" ? value : item.sell_price;

    const costNum = parseFloat(cost) || 0;
    const marginNum = parseFloat(margin) || 0;
    const sellNum = parseFloat(sell) || 0;

    if (field === "cost_price" || field === "margin_percentage") {
      const newSellNum = costNum * (1 + marginNum / 100);
      return {
        cost_price: cost,
        margin_percentage: margin,
        sell_price: newSellNum.toFixed(2),
      };
    }

    if (field === "sell_price") {
      const newMargin = costNum > 0 ? (((sellNum - costNum) / costNum) * 100).toFixed(2) : "0";
      return {
        cost_price: cost,
        margin_percentage: newMargin,
        sell_price: sell,
      };
    }

    return { cost_price: cost, margin_percentage: margin, sell_price: sell };
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    const newItems = [...lineItems];
    const item = newItems[index];

    if (field === "cost_price" || field === "margin_percentage" || field === "sell_price") {
      const pricing = calculatePricing(field, value, item);
      item.cost_price = pricing.cost_price;
      item.margin_percentage = pricing.margin_percentage;
      item.sell_price = pricing.sell_price;
      
      // Mark auto-updated fields
      if (field === "cost_price" || field === "margin_percentage") {
        const sellKey = `${index}-sell_price`;
        setUpdatedFields(prev => ({ ...prev, [sellKey]: true }));
        clearUpdatedField(sellKey);
      } else if (field === "sell_price") {
        const marginKey = `${index}-margin_percentage`;
        setUpdatedFields(prev => ({ ...prev, [marginKey]: true }));
        clearUpdatedField(marginKey);
      }
    } else {
      (item as any)[field] = value;
    }

    item.line_total = calculateLineTotal(item);
    
    // Mark line total as updated
    const totalKey = `${index}-line_total`;
    setUpdatedFields(prev => ({ ...prev, [totalKey]: true }));
    clearUpdatedField(totalKey);
    
    onChange(newItems);
  };

  const updateSubItem = (parentIndex: number, subIndex: number, field: string, value: string) => {
    const newItems = [...lineItems];
    const subItem = newItems[parentIndex].subItems![subIndex];

    if (field === "cost_price" || field === "margin_percentage" || field === "sell_price") {
      const pricing = calculatePricing(field, value, subItem);
      subItem.cost_price = pricing.cost_price;
      subItem.margin_percentage = pricing.margin_percentage;
      subItem.sell_price = pricing.sell_price;
      
      // Mark auto-updated fields
      if (field === "cost_price" || field === "margin_percentage") {
        const sellKey = `${parentIndex}-${subIndex}-sell_price`;
        setUpdatedFields(prev => ({ ...prev, [sellKey]: true }));
        clearUpdatedField(sellKey);
      } else if (field === "sell_price") {
        const marginKey = `${parentIndex}-${subIndex}-margin_percentage`;
        setUpdatedFields(prev => ({ ...prev, [marginKey]: true }));
        clearUpdatedField(marginKey);
      }
    } else {
      (subItem as any)[field] = value;
    }

    subItem.line_total = calculateLineTotal(subItem);
    
    // Mark sub-item line total as updated
    const subTotalKey = `${parentIndex}-${subIndex}-line_total`;
    setUpdatedFields(prev => ({ ...prev, [subTotalKey]: true }));
    clearUpdatedField(subTotalKey);
    
    newItems[parentIndex].line_total = calculateLineTotal(newItems[parentIndex]);
    
    // Mark parent line total as updated
    const parentTotalKey = `${parentIndex}-line_total`;
    setUpdatedFields(prev => ({ ...prev, [parentTotalKey]: true }));
    clearUpdatedField(parentTotalKey);
    
    onChange(newItems);
  };

  const addLineItem = () => {
    onChange([
      ...lineItems,
      {
        description: "",
        quantity: "1",
        cost_price: "",
        margin_percentage: defaultMarginPercentage.toString(),
        sell_price: "",
        line_total: 0,
        subItems: [],
        expanded: false,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    onChange(lineItems.filter((_, i) => i !== index));
  };

  const addSubItem = (parentIndex: number) => {
    const newItems = [...lineItems];
    if (!newItems[parentIndex].subItems) {
      newItems[parentIndex].subItems = [];
    }
    newItems[parentIndex].subItems!.push({
      description: "",
      quantity: "1",
      cost_price: "",
      margin_percentage: defaultMarginPercentage.toString(),
      sell_price: "",
      line_total: 0,
    });
    newItems[parentIndex].expanded = true;
    onChange(newItems);
  };

  const removeSubItem = (parentIndex: number, subIndex: number) => {
    const newItems = [...lineItems];
    newItems[parentIndex].subItems = newItems[parentIndex].subItems!.filter((_, i) => i !== subIndex);
    newItems[parentIndex].line_total = calculateLineTotal(newItems[parentIndex]);
    onChange(newItems);
  };

  const toggleExpanded = (index: number) => {
    const newItems = [...lineItems];
    newItems[index].expanded = !newItems[index].expanded;
    onChange(newItems);
  };

  const hasSubItems = (item: LineItem) => item.subItems && item.subItems.length > 0;

  if (readOnly) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="min-w-[300px]">Description</TableHead>
              <TableHead className="w-[100px] text-right">Quantity</TableHead>
              <TableHead className="w-[120px] text-right">Cost</TableHead>
              <TableHead className="w-[100px] text-right">Margin %</TableHead>
              <TableHead className="w-[120px] text-right">Sell</TableHead>
              <TableHead className="w-[120px] text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((item, index) => {
              const subItems = item.subItems || [];
              const itemHasSubItems = subItems.length > 0;

              return (
                <>
                  <TableRow key={index} className="border-b">
                    <TableCell>
                      {itemHasSubItems && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleExpanded(index)}
                        >
                          {item.expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{item.description}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">{item.quantity}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {itemHasSubItems ? (
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(calculateAggregatedValues(item).cost)}
                        </span>
                      ) : (
                        <span className="text-sm">{formatCurrency(parseFloat(item.cost_price))}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {itemHasSubItems ? (
                        <span className="text-sm text-muted-foreground">
                          {calculateAggregatedValues(item).margin.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-sm">{parseFloat(item.margin_percentage).toFixed(2)}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {itemHasSubItems ? (
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(calculateAggregatedValues(item).sell)}
                        </span>
                      ) : (
                        <span className="text-sm">{formatCurrency(parseFloat(item.sell_price))}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.line_total)}
                    </TableCell>
                  </TableRow>

                  {item.expanded && itemHasSubItems && subItems.map((subItem, subIndex) => (
                    <TableRow key={`${index}-${subIndex}`} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell className="pl-12">
                        <span className="text-sm">{subItem.description}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm">{subItem.quantity}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm">{formatCurrency(parseFloat(subItem.cost_price))}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm">{parseFloat(subItem.margin_percentage).toFixed(2)}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm">{formatCurrency(parseFloat(subItem.sell_price))}</span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(subItem.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="min-w-[300px]">Description</TableHead>
              <TableHead className="w-[100px] text-right">Quantity</TableHead>
              <TableHead className="w-[120px] text-right">Cost</TableHead>
              <TableHead className="w-[100px] text-right">Margin %</TableHead>
              <TableHead className="w-[120px] text-right">Sell</TableHead>
              <TableHead className="w-[120px] text-right">Total</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((item, index) => (
              <>
                <TableRow key={index} className="border-b">
                  <TableCell>
                    {hasSubItems(item) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleExpanded(index)}
                      >
                        {item.expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Item description"
                      className="border-0 focus-visible:ring-0 bg-transparent"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="border-0 focus-visible:ring-0 text-right bg-transparent"
                    />
                  </TableCell>
                  <TableCell>
                    {hasSubItems(item) ? (
                      <div className="text-right text-sm text-muted-foreground pr-3">
                        {formatCurrency(calculateAggregatedValues(item).cost)}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        value={item.cost_price}
                        onChange={(e) => updateLineItem(index, "cost_price", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="border-0 focus-visible:ring-0 text-right bg-transparent"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {hasSubItems(item) ? (
                      <div className="text-right text-sm text-muted-foreground pr-3">
                        {calculateAggregatedValues(item).margin.toFixed(2)}%
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        value={item.margin_percentage}
                        onChange={(e) => updateLineItem(index, "margin_percentage", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className={`border-0 focus-visible:ring-0 text-right bg-transparent transition-colors ${
                          updatedFields[`${index}-margin_percentage`] ? 'bg-primary/20 animate-pulse' : ''
                        }`}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {hasSubItems(item) ? (
                      <div className="text-right text-sm text-muted-foreground pr-3">
                        {formatCurrency(calculateAggregatedValues(item).sell)}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        value={item.sell_price}
                        onChange={(e) => updateLineItem(index, "sell_price", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className={`border-0 focus-visible:ring-0 text-right bg-transparent transition-colors ${
                          updatedFields[`${index}-sell_price`] ? 'bg-primary/20 animate-pulse' : ''
                        }`}
                      />
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-medium transition-colors ${
                    updatedFields[`${index}-line_total`] ? 'bg-primary/10 animate-pulse' : ''
                  }`}>
                    {formatCurrency(item.line_total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => addSubItem(index)}
                        title="Add sub-item"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Sub-items */}
                {item.expanded && item.subItems && item.subItems.length > 0 && (
                  item.subItems.map((subItem, subIndex) => (
                    <TableRow key={`${index}-${subIndex}`} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell className="pl-12">
                        <Input
                          value={subItem.description}
                          onChange={(e) =>
                            updateSubItem(index, subIndex, "description", e.target.value)
                          }
                          placeholder="Sub-item description"
                          className="border-0 focus-visible:ring-0 text-sm bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={subItem.quantity}
                          onChange={(e) =>
                            updateSubItem(index, subIndex, "quantity", e.target.value)
                          }
                          onFocus={(e) => e.target.select()}
                          className="border-0 focus-visible:ring-0 text-right text-sm bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={subItem.cost_price}
                          onChange={(e) =>
                            updateSubItem(index, subIndex, "cost_price", e.target.value)
                          }
                          onFocus={(e) => e.target.select()}
                          className="border-0 focus-visible:ring-0 text-right text-sm bg-transparent"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={subItem.margin_percentage}
                          onChange={(e) =>
                            updateSubItem(index, subIndex, "margin_percentage", e.target.value)
                          }
                          onFocus={(e) => e.target.select()}
                          className={`border-0 focus-visible:ring-0 text-right text-sm bg-transparent transition-colors ${
                            updatedFields[`${index}-${subIndex}-margin_percentage`] ? 'bg-primary/20 animate-pulse' : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={subItem.sell_price}
                          onChange={(e) =>
                            updateSubItem(index, subIndex, "sell_price", e.target.value)
                          }
                          onFocus={(e) => e.target.select()}
                          className={`border-0 focus-visible:ring-0 text-right text-sm bg-transparent transition-colors ${
                            updatedFields[`${index}-${subIndex}-sell_price`] ? 'bg-primary/20 animate-pulse' : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell className={`text-right text-sm transition-colors ${
                        updatedFields[`${index}-${subIndex}-line_total`] ? 'bg-primary/10 animate-pulse' : ''
                      }`}>
                        {formatCurrency(subItem.line_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeSubItem(index, subIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="outline" onClick={addLineItem}>
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </Button>
    </div>
  );
}
