"use client";

import { Trash2, ArrowUp, ArrowDown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getRelativeTime } from "@/lib/utils";
import type { Alert } from "@/types";

interface AlertListProps {
  alerts: Alert[];
  onDelete: (id: string) => void;
}

export function AlertList({ alerts, onDelete }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium text-[14px] mb-1">No active alerts</p>
        <p className="text-muted-foreground text-[13px] max-w-xs">
          Set a price target on any symbol and get notified when it's reached.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Card key={alert.id} className="bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {alert.direction === "above" ? (
                <ArrowUp className="h-4 w-4 text-gain" />
              ) : (
                <ArrowDown className="h-4 w-4 text-loss" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium truncate max-w-[120px]">{alert.symbol}</span>
                  <Badge variant="secondary" className="text-xs">
                    {alert.direction}
                  </Badge>
                  {alert.triggered && (
                    <Badge className="text-xs bg-gain/10 text-gain">
                      Triggered
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono">{formatCurrency(alert.target_price)}</span> &middot;{" "}
                  {getRelativeTime(alert.created_at)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete alert"
              onClick={() => onDelete(alert.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
