"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AlertForm } from "@/components/alerts/AlertForm";
import { AlertList } from "@/components/alerts/AlertList";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAlerts, createAlert, deleteAlert } from "@/lib/api";
import { toast } from "sonner";
import type { CreateAlertRequest } from "@/types";

export default function AlertsPage() {
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Alerts | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const {
    data: alerts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateAlertRequest) => createAlert(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert created successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create alert");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete alert");
    },
  });

  const handleCreate = async (alert: CreateAlertRequest) => {
    await createMutation.mutateAsync(alert);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (error) {
    return (
      <AuthGuard>
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">
          Failed to load alerts.{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Set price alerts for stocks and crypto
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <AlertForm
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-4 font-heading">Active Alerts</h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <AlertList alerts={alerts ?? []} onDelete={handleDelete} />
          )}
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
