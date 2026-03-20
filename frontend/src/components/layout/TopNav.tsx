"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Search, LogOut, Star, Menu, ChevronDown, Briefcase, Bell, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MarketSearch } from "@/components/market/MarketSearch";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

const navLinks = [
  { href: "/", label: "Market" },
  { href: "/heatmap", label: "Heatmap" },
  { href: "/charts", label: "Charts" },
  { href: "/predictions", label: "Predictions" },
  { href: "/news", label: "News" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();
  const toggleWatchlist = useUIStore((s) => s.toggleWatchlist);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 h-14 w-full border-b border-[#1c1c1c] bg-black/95 backdrop-blur relative flex items-center justify-between px-4">
        <div className="flex items-center gap-2 shrink-0 z-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-heading font-bold text-[#e8e6e3] text-sm">FinancePulse</span>
          </Link>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-3xl px-36 hidden md:block">
          <MarketSearch />
        </div>

        <div className="flex items-center gap-3 shrink-0 z-10">
          <button
            onClick={() => {
              document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
            }}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground md:hidden"
            aria-label="Search markets"
          >
            <Search className="h-4.5 w-4.5" />
          </button>

          <nav className="hidden items-center gap-3 shrink-0 lg:flex">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-medium transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={toggleWatchlist}
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
            title="Watchlist (w)"
          >
            <Star className="h-4.5 w-4.5" />
          </button>

          <div className="shrink-0">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded-full">
                <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 hover:border-primary/50 transition-colors">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-bold">
                      {user?.email?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[13px] text-foreground font-medium hidden sm:block max-w-[100px] truncate">
                    {user?.email?.split("@")[0] ?? "User"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-border bg-card min-w-[200px] shadow-2xl"
              >
                <div className="px-3 py-2">
                  <p className="text-[12px] text-muted-foreground truncate">{user?.email}</p>
                  {user?.created_at && (
                    <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                      Joined {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {}} className="p-0">
                  <Link href="/portfolio" className="flex items-center gap-2 w-full px-3 py-2 text-[13px]">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    Portfolio
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={toggleWatchlist}
                  className="flex items-center gap-2 px-3 py-2 text-[13px]"
                >
                  <Star className="h-3.5 w-3.5 text-muted-foreground" />
                  Watchlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}} className="p-0">
                  <Link href="/alerts" className="flex items-center gap-2 w-full px-3 py-2 text-[13px]">
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    Alerts
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}} className="p-0">
                  <Link href="/settings" className="flex items-center gap-2 w-full px-3 py-2 text-[13px]">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-loss focus:text-loss"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="text-[13px] font-medium border border-primary text-primary rounded-full px-4 py-1 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Sign In
            </Link>
          )}
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-heading">Navigation</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col py-2">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-4 py-2.5 text-[14px] font-medium transition-colors ${
                    isActive
                      ? "border-l-2 border-primary text-primary bg-primary/5"
                      : "border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
