"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TrendingUp, TrendingDown, Calendar, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { AuthGuard } from "@/components/layout/AuthGuard";
import {
  fetchPortfolio,
  fetchHistory,
  addHolding,
  removeHolding,
  deletePortfolio,
  updateHolding,
} from "@/lib/api";
import type { CreateHoldingRequest, UpdateHoldingRequest, HoldingWithPrice } from "@/types";
import { formatCurrency, formatPercent, getRelativeTime, cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePriceStore } from "@/stores/priceStore";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import dynamic from "next/dynamic";

const PerformanceChart = dynamic(
  () => import("@/components/charts/PerformanceChart").then((mod) => mod.PerformanceChart),
  {
    ssr: false,
    loading: () => <div className="w-full h-[300px] bg-card animate-pulse rounded-lg" />,
  }
);
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function useLiveSummary(holdings: HoldingWithPrice[]) {
  const prices = usePriceStore((s) => s.prices);

  return useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;

    for (const h of holdings) {
      const livePrice = prices[h.symbol]?.price ?? h.current_price;
      totalCost += h.quantity * h.avg_cost;
      if (livePrice != null) {
        totalValue += h.quantity * livePrice;
      }
    }

    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return { totalValue, totalCost, totalPnl, totalPnlPercent };
  }, [holdings, prices]);
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<HoldingWithPrice | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editAvgCost, setEditAvgCost] = useState("");
  const [buyQty, setBuyQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellQty, setSellQty] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [assetType, setAssetType] = useState<"stock" | "crypto" | "etf" | "commodity" | "index" | "bonds">("stock");

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    isError: portfolioError,
    error: portfolioErr,
  } = useQuery({
    queryKey: ["portfolio", id],
    queryFn: () => fetchPortfolio(id),
    enabled: !!id,
  });

  const holdingSymbols = useMemo(
    () => (portfolio?.holdings ?? []).map((h) => h.symbol),
    [portfolio?.holdings]
  );

  useEffect(() => {
    const name = portfolio?.name;
    document.title = name ? `${name} | FinancePulse` : "Portfolio | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, [portfolio?.name]);

  useWebSocket({
    symbols: holdingSymbols,
    enabled: holdingSymbols.length > 0,
  });

  const { totalValue, totalPnl, totalPnlPercent } = useLiveSummary(
    portfolio?.holdings ?? []
  );
  const holdingsCount = portfolio?.holdings.length ?? 0;

  const historyQueries = useQueries({
    queries: holdingSymbols.map((sym) => ({
      queryKey: ["history", sym, "1M"],
      queryFn: () => fetchHistory(sym, "1M"),
      enabled: holdingSymbols.length > 0,
      staleTime: 5 * 60_000,
    })),
  });

  const performanceData = useMemo(() => {
    if (!portfolio?.holdings || holdingSymbols.length === 0) return [];

    const allLoaded = historyQueries.every((q) => q.isSuccess);
    if (!allLoaded) return [];

    const holdingMap = new Map<string, number>();
    for (const h of portfolio.holdings) {
      holdingMap.set(h.symbol, (holdingMap.get(h.symbol) ?? 0) + h.quantity);
    }

    const priceBySymbolDate = new Map<string, Map<string, number>>();
    const allDates = new Set<string>();

    for (let i = 0; i < holdingSymbols.length; i++) {
      const candles = historyQueries[i].data;
      if (!candles) continue;

      const sym = holdingSymbols[i];
      const dateMap = new Map<string, number>();

      for (const c of candles) {
        const dateStr = format(new Date(c.timestamp), "yyyy-MM-dd");
        dateMap.set(dateStr, c.close);
        allDates.add(dateStr);
      }

      priceBySymbolDate.set(sym, dateMap);
    }

    const sortedDates = [...allDates].sort();

    return sortedDates.map((dateStr) => {
      let dayValue = 0;
      for (const [sym, qty] of holdingMap) {
        const closePrice = priceBySymbolDate.get(sym)?.get(dateStr);
        if (closePrice != null) {
          dayValue += qty * closePrice;
        }
      }

      return {
        date: format(new Date(dateStr), "MMM d"),
        value: Math.round(dayValue * 100) / 100,
      };
    });
  }, [portfolio?.holdings, holdingSymbols, historyQueries]);

  const historyLoading = historyQueries.some((q) => q.isLoading);

  const addHoldingMutation = useMutation({
    mutationFn: (body: CreateHoldingRequest) => addHolding(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", id] });
      toast.success("Holding added successfully");
      resetAddForm();
      setAddDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add holding");
    },
  });

  const removeHoldingMutation = useMutation({
    mutationFn: (holdingId: string) => removeHolding(id, holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", id] });
      toast.success("Holding removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove holding");
    },
  });

  const updateHoldingMutation = useMutation({
    mutationFn: ({ holdingId, body }: { holdingId: string; body: UpdateHoldingRequest }) =>
      updateHolding(id, holdingId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", id] });
      toast.success("Holding updated");
      setEditDialogOpen(false);
      setEditingHolding(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update holding");
    },
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: () => deletePortfolio(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast.success("Portfolio deleted");
      router.push("/portfolio");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete portfolio");
    },
  });

  function openEditDialog(holding: HoldingWithPrice) {
    setEditingHolding(holding);
    setEditQuantity(String(holding.quantity));
    setEditAvgCost(String(holding.avg_cost));
    setBuyQty("");
    setBuyPrice("");
    setSellQty("");
    setEditDialogOpen(true);
  }

  function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingHolding) return;
    const qty = parseFloat(editQuantity);
    const cost = parseFloat(editAvgCost);
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
      toast.error("Quantity and average cost must be positive numbers");
      return;
    }
    updateHoldingMutation.mutate({
      holdingId: editingHolding.id,
      body: { quantity: qty, avg_cost: cost },
    });
  }

  function handleLogBuy() {
    if (!editingHolding) return;
    const addQty = parseFloat(buyQty);
    const price = parseFloat(buyPrice);
    if (isNaN(addQty) || addQty <= 0 || isNaN(price) || price <= 0) {
      toast.error("Enter valid quantity and price");
      return;
    }
    const oldQty = parseFloat(editQuantity) || editingHolding.quantity;
    const oldCost = parseFloat(editAvgCost) || editingHolding.avg_cost;
    const newQty = oldQty + addQty;
    const newAvg = ((oldQty * oldCost) + (addQty * price)) / newQty;
    setEditQuantity(String(parseFloat(newQty.toFixed(8))));
    setEditAvgCost(String(parseFloat(newAvg.toFixed(4))));
    setBuyQty("");
    setBuyPrice("");
  }

  function handleLogSell() {
    if (!editingHolding) return;
    const sellAmount = parseFloat(sellQty);
    const currentQty = parseFloat(editQuantity) || editingHolding.quantity;
    if (isNaN(sellAmount) || sellAmount <= 0) {
      toast.error("Enter a valid quantity to sell");
      return;
    }
    if (sellAmount > currentQty) {
      toast.error(`Cannot sell more than you hold (${currentQty})`);
      return;
    }
    setEditQuantity(String(parseFloat((currentQty - sellAmount).toFixed(8))));
    setSellQty("");
  }

  function resetAddForm() {
    setSymbol("");
    setQuantity("");
    setAvgCost("");
    setAssetType("stock");
  }

  function handleAddHolding(e: React.FormEvent) {
    e.preventDefault();
    const trimmedSymbol = symbol.trim().toUpperCase();
    const qty = parseFloat(quantity);
    const cost = parseFloat(avgCost);

    if (!trimmedSymbol || isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
      toast.error("Please fill in all fields with valid values");
      return;
    }

    addHoldingMutation.mutate({
      symbol: trimmedSymbol,
      quantity: qty,
      avg_cost: cost,
      asset_type: assetType,
    });
  }

  if (portfolioLoading) {
    return (
      <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-card border-border">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
      </AuthGuard>
    );
  }

  if (portfolioError) {
    return (
      <AuthGuard>
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">
            {portfolioErr instanceof Error
              ? portfolioErr.message
              : "Failed to load portfolio"}
          </p>
        </CardContent>
      </Card>
      </AuthGuard>
    );
  }

  if (!portfolio) return null;

  return (
    <AuthGuard>
    <div className="space-y-6">
      <div>
        <Link href="/portfolio" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
          <ChevronLeft className="w-4 h-4" />
          Back to Portfolios
        </Link>

        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{portfolio.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Created {getRelativeTime(portfolio.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holding
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Holding</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddHolding} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="e.g. AAPL or BTC"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avg-cost">Avg Cost</Label>
                    <Input
                      id="avg-cost"
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={avgCost}
                      onChange={(e) => setAvgCost(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-type">Asset Type</Label>
                  <Select
                    value={assetType}
                    onValueChange={(v) => setAssetType(v as "stock" | "crypto" | "etf" | "commodity" | "index" | "bonds")}
                  >
                    <SelectTrigger id="asset-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                      <SelectItem value="etf">ETF</SelectItem>
                      <SelectItem value="commodity">Commodity</SelectItem>
                      <SelectItem value="index">Index</SelectItem>
                      <SelectItem value="bonds">Bonds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetAddForm();
                      setAddDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={addHoldingMutation.isPending}
                  >
                    {addHoldingMutation.isPending ? "Adding..." : "Add"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Portfolio</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;{portfolio.name}&rdquo;?
                This action cannot be undone and all holdings will be removed.
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deletePortfolioMutation.mutate()}
                  disabled={deletePortfolioMutation.isPending}
                >
                  {deletePortfolioMutation.isPending
                    ? "Deleting..."
                    : "Delete Portfolio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold mt-1 font-mono">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total P&L</p>
            <div className="mt-1 flex items-center gap-1.5">
              {totalPnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-gain" />
              ) : (
                <TrendingDown className="h-4 w-4 text-loss" />
              )}
              <p
                className={cn(
                  "text-2xl font-bold font-mono",
                  totalPnl >= 0 ? "text-gain" : "text-loss"
                )}
              >
                {formatCurrency(Math.abs(totalPnl))}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">P&L %</p>
            <p
              className={cn(
                "text-2xl font-bold mt-1 font-mono",
                totalPnlPercent >= 0 ? "text-gain" : "text-loss"
              )}
            >
              {formatPercent(totalPnlPercent)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Holdings</p>
            <p className="text-2xl font-bold mt-1">{holdingsCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">30-Day Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div
              className="w-full rounded-lg overflow-hidden flex items-center justify-center bg-card"
              style={{ height: 300 }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading chart data...</p>
              </div>
            </div>
          ) : (
            <PerformanceChart data={performanceData} height={300} />
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <HoldingsTable
            holdings={portfolio.holdings}
            onDelete={(holdingId) => removeHoldingMutation.mutate(holdingId)}
            onEdit={openEditDialog}
          />
        </CardContent>
      </Card>

      {/* Edit Holding Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setEditingHolding(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editingHolding?.symbol ?? "Holding"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input value={editingHolding?.symbol ?? ""} disabled className="font-mono" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  step="any"
                  min="0"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-avg-cost">Average Cost</Label>
                <Input
                  id="edit-avg-cost"
                  type="number"
                  step="any"
                  min="0"
                  value={editAvgCost}
                  onChange={(e) => setEditAvgCost(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <Separator />

            {/* Log a Buy helper */}
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-muted-foreground">Log a Buy</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="buy-qty" className="text-xs text-muted-foreground">Additional Qty</Label>
                  <Input
                    id="buy-qty"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={buyQty}
                    onChange={(e) => setBuyQty(e.target.value)}
                    className="font-mono h-8 text-[13px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="buy-price" className="text-xs text-muted-foreground">Purchase Price</Label>
                  <Input
                    id="buy-price"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className="font-mono h-8 text-[13px]"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleLogBuy}
                disabled={!buyQty || !buyPrice}
              >
                Calculate Weighted Average
              </Button>
            </div>

            {/* Log a Sell helper */}
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-muted-foreground">Log a Sell</p>
              <div className="flex gap-3">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="sell-qty" className="text-xs text-muted-foreground">Sell Quantity</Label>
                  <Input
                    id="sell-qty"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={sellQty}
                    onChange={(e) => setSellQty(e.target.value)}
                    className="font-mono h-8 text-[13px]"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={handleLogSell}
                    disabled={!sellQty}
                  >
                    Reduce
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={updateHoldingMutation.isPending}
              >
                {updateHoldingMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  );
}
