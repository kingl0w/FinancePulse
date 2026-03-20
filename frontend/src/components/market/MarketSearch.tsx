"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { searchMarket } from "@/lib/api";
import type { SearchResult } from "@/types";

const RECENT_SEARCHES_KEY = "financepulse:recent-searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return [];
  } catch {
    return [];
  }
}

function addRecentSearch(symbol: string) {
  const recent = getRecentSearches().filter((s) => s !== symbol);
  recent.unshift(symbol);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

export function MarketSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchMarket(trimmed);
        setResults(data.slice(0, 8));
        setOpen(data.length > 0);
        setSelectedIndex(0);
      } catch {
        setResults([]);
        setOpen(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Ctrl+K global shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (symbol: string) => {
      addRecentSearch(symbol);
      router.push(`/market/${symbol}`);
      setQuery("");
      setResults([]);
      setOpen(false);
      inputRef.current?.blur();
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(results[selectedIndex].symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        data-search-input
        type="text"
        placeholder="Search markets... (Ctrl+K)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        className="h-9 w-full rounded-lg border border-secondary bg-card pl-10 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 focus:shadow-[0_0_10px_rgba(240,180,41,0.08)]"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-2xl z-50">
          {results.map((r, i) => (
            <button
              key={r.symbol}
              onMouseDown={() => handleSelect(r.symbol)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full px-3 py-2.5 flex items-center gap-4 text-left transition-colors border-b border-border last:border-b-0 ${
                i === selectedIndex
                  ? "bg-secondary"
                  : "hover:bg-muted"
              }`}
            >
              <span className="font-mono font-bold text-primary text-[13px] w-28 shrink-0">
                {r.symbol}
              </span>
              <span className="text-[13px] text-foreground truncate flex-1 min-w-0">
                {r.name}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-border text-muted-foreground shrink-0 uppercase">
                {r.asset_type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
