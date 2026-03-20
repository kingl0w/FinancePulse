"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CreateAlertRequest } from "@/types";

interface AlertFormProps {
  onSubmit: (alert: CreateAlertRequest) => Promise<void> | void;
  isLoading?: boolean;
}

export function AlertForm({ onSubmit, isLoading }: AlertFormProps) {
  const [symbol, setSymbol] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !targetPrice) return;
    await onSubmit({
      symbol: symbol.toUpperCase(),
      target_price: parseFloat(targetPrice),
      direction,
    });
    setSymbol("");
    setTargetPrice("");
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base">Create Alert</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="BTC, AAPL..."
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-price">Target Price</Label>
            <Input
              id="target-price"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Direction</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Price direction">
              <Button
                type="button"
                variant={direction === "above" ? "default" : "outline"}
                size="sm"
                role="radio"
                aria-checked={direction === "above"}
                onClick={() => setDirection("above")}
              >
                Price Above
              </Button>
              <Button
                type="button"
                variant={direction === "below" ? "default" : "outline"}
                size="sm"
                role="radio"
                aria-checked={direction === "below"}
                onClick={() => setDirection("below")}
              >
                Price Below
              </Button>
            </div>
          </fieldset>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Alert"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
