"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/authStore";
import { deleteAccount } from "@/lib/api";
import { getRelativeTime } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    document.title = "Settings | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  return (
    <AuthGuard>
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Member since</Label>
            <Input
              value={
                user?.created_at ? getRelativeTime(user.created_at) : ""
              }
              disabled
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Configure alert notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Price Alerts</p>
              <p className="text-xs text-muted-foreground">
                Get notified when price targets are hit
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Portfolio Updates</p>
              <p className="text-xs text-muted-foreground">
                Daily portfolio performance summary
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-start gap-3 pt-2">
        <button
          onClick={logout}
          className="flex items-center gap-2 border border-border text-muted-foreground hover:text-loss hover:border-loss rounded-lg px-6 py-2 text-[13px] font-medium transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
        <button
          onClick={() => setDeleteDialogOpen(true)}
          className="flex items-center gap-2 border border-loss text-loss rounded-lg px-6 py-2 text-[13px] font-medium hover:bg-loss hover:text-primary-foreground transition-colors"
        >
          Delete Account
        </button>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure? This will permanently delete your account and all data
            including portfolios, holdings, alerts, and watchlists. This action
            cannot be undone.
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
              onClick={async () => {
                try {
                  await deleteAccount();
                  setDeleteDialogOpen(false);
                  logout();
                  router.push("/");
                } catch {
                  toast.error("Failed to delete account");
                }
              }}
            >
              Delete Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  );
}
