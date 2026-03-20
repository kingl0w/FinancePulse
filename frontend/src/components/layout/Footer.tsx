"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Activity } from "lucide-react";

const HIDE_FOOTER_PATHS = ["/charts"];

export function Footer() {
  const pathname = usePathname();

  if (HIDE_FOOTER_PATHS.includes(pathname)) return null;

  return (
    <footer className="border-t border-border mt-auto py-6 px-4">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span>FinancePulse</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        </div>
        <div>
          Market data by Finnhub, Coinbase &amp; CoinGecko
        </div>
      </div>
    </footer>
  );
}
