"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/stores/uiStore";

export function useKeyboardShortcuts() {
  const router = useRouter();
  const toggleWatchlist = useUIStore((s) => s.toggleWatchlist);
  const toggleShortcuts = useUIStore((s) => s.toggleShortcuts);
  const closeAll = useUIStore((s) => s.closeAll);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        if (e.key === "Escape") {
          (document.activeElement as HTMLElement)?.blur();
          closeAll();
        }
        return;
      }

      switch (e.key) {
        case "/":
          e.preventDefault();
          document
            .querySelector<HTMLInputElement>("[data-search-input]")
            ?.focus();
          break;
        case "Escape":
          (document.activeElement as HTMLElement)?.blur();
          closeAll();
          break;
        case "w":
          toggleWatchlist();
          break;
        case "h":
          router.push("/heatmap");
          break;
        case "c":
          router.push("/charts");
          break;
        case "n":
          router.push("/news");
          break;
        case "p":
          router.push("/predictions");
          break;
        case "?":
          toggleShortcuts();
          break;
      }

      if (/^[0-9]$/.test(e.key)) {
        const timeframes = [
          "1m",
          "5m",
          "15m",
          "30m",
          "1H",
          "1D",
          "1W",
          "1M",
          "3M",
          "1Y",
        ];
        const index = e.key === "0" ? 9 : parseInt(e.key) - 1;
        window.dispatchEvent(
          new CustomEvent("shortcut-timeframe", { detail: timeframes[index] })
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, toggleWatchlist, toggleShortcuts, closeAll]);
}
