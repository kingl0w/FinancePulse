"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/uiStore";

const SECTIONS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["/"], desc: "Search" },
      { keys: ["Esc"], desc: "Close / Blur" },
      { keys: ["w"], desc: "Watchlist" },
      { keys: ["h"], desc: "Heatmap" },
      { keys: ["c"], desc: "Charts" },
      { keys: ["n"], desc: "News" },
      { keys: ["p"], desc: "Predictions" },
    ],
  },
  {
    title: "Chart Timeframes",
    shortcuts: [
      { keys: ["1"], desc: "1m" },
      { keys: ["2"], desc: "5m" },
      { keys: ["3"], desc: "15m" },
      { keys: ["4"], desc: "30m" },
      { keys: ["5"], desc: "1H" },
      { keys: ["6"], desc: "1D" },
      { keys: ["7"], desc: "1W" },
      { keys: ["8"], desc: "1M" },
      { keys: ["9"], desc: "3M" },
      { keys: ["0"], desc: "1Y" },
    ],
  },
  {
    title: "Other",
    shortcuts: [{ keys: ["?"], desc: "This help" }],
  },
];

export function ShortcutsHelp() {
  const { shortcutsOpen, setShortcutsOpen } = useUIStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShortcutsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [shortcutsOpen, setShortcutsOpen]);

  if (!shortcutsOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-muted p-6 shadow-2xl"
      >
        <h2 className="mb-5 text-center text-[18px] font-bold font-heading text-foreground">
          Keyboard Shortcuts
        </h2>

        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <div
                    key={s.desc}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex min-w-[28px] items-center justify-center rounded bg-border px-2 py-0.5 font-mono text-[13px] text-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span className="text-[14px] text-foreground">
                      {s.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShortcutsOpen(false)}
          className="mt-5 w-full rounded-lg bg-border py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function ShortcutsHelpButton() {
  const toggleShortcuts = useUIStore((s) => s.toggleShortcuts);

  return (
    <button
      onClick={toggleShortcuts}
      className="fixed bottom-4 right-4 z-50 hidden h-8 w-8 items-center justify-center rounded-full bg-border font-mono text-[14px] text-foreground transition-colors hover:bg-secondary md:flex"
      title="Keyboard shortcuts (?)"
    >
      ?
    </button>
  );
}
