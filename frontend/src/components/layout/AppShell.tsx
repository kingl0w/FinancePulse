"use client";

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { WatchlistPanel } from "@/components/market/WatchlistPanel";
import { ShortcutsHelp, ShortcutsHelpButton } from "@/components/ui/ShortcutsHelp";

export function AppShell({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts();

  return (
    <>
      {children}
      <WatchlistPanel />
      <ShortcutsHelp />
      <ShortcutsHelpButton />
    </>
  );
}
