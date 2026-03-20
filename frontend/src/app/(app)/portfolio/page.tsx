"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Briefcase } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { AuthGuard } from "@/components/layout/AuthGuard";
import { fetchPortfolios, fetchPerformance, createPortfolio } from "@/lib/api";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PortfolioListPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    document.title = "Portfolio | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const {
    data: portfolios,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["portfolios"],
    queryFn: fetchPortfolios,
  });

  const performanceQueries = useQueries({
    queries: (portfolios ?? []).map((p) => ({
      queryKey: ["performance", p.id],
      queryFn: () => fetchPerformance(p.id),
      enabled: p.holding_count > 0,
      staleTime: 30_000,
    })),
  });

  const createMutation = useMutation({
    mutationFn: (portfolioName: string) => createPortfolio(portfolioName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast.success("Portfolio created successfully");
      setName("");
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create portfolio");
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  }

  return (
    <AuthGuard>
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Portfolios</h1>
          <p className="text-sm text-muted-foreground">
            Manage your investment portfolios
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                New Portfolio
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Portfolio</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="portfolio-name">Portfolio Name</Label>
                <Input
                  id="portfolio-name"
                  placeholder="e.g. Tech Stocks"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!name.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-3 w-48 mb-4" />
                <div className="flex items-end justify-between">
                  <div>
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-3 w-16 mt-2" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-3 w-12 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load portfolios"}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && portfolios?.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center py-16 px-6">
            <Briefcase className="h-10 w-10 text-muted-foreground/40 mb-4" />
            <p className="text-foreground font-medium text-[15px] mb-1">
              No portfolios yet
            </p>
            <p className="text-muted-foreground text-[13px] mb-6 text-center max-w-xs">
              Create a portfolio to track your holdings and monitor performance across stocks and crypto.
            </p>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Portfolio
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && portfolios && portfolios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((portfolio, idx) => {
            const perfQuery = performanceQueries[idx];
            const perf = perfQuery?.data;
            const isLoadingPrices = portfolio.holding_count > 0 && (perfQuery?.isLoading ?? true);

            return (
              <Link key={portfolio.id} href={`/portfolio/${portfolio.id}`}>
                <PortfolioCard
                  portfolio={portfolio}
                  totalInvested={perf?.total_cost}
                  currentValue={perf?.total_value}
                  isLoadingPrices={isLoadingPrices}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
