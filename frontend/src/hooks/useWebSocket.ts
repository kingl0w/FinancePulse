"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WsMessage, WsPriceUpdate } from "@/types";
import { usePriceStore } from "@/stores/priceStore";
import { useAuthStore } from "@/stores/authStore";

interface UseWebSocketOptions {
  url?: string;
  symbols?: string[];
  enabled?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 10;

export function useWebSocket(
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const { url = WS_URL, symbols = [], enabled = true } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1_000);
  const retriesRef = useRef(0);
  const symbolsRef = useRef(symbols);
  const [isConnected, setIsConnected] = useState(false);

  const setPrice = usePriceStore((s) => s.setPrice);
  const priceStoreSubscribe = usePriceStore((s) => s.subscribe);
  const priceStoreUnsubscribe = usePriceStore((s) => s.unsubscribe);

  symbolsRef.current = symbols;

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const subscribe = useCallback(
    (syms: string[]) => {
      send({ type: "subscribe", symbols: syms });
      priceStoreSubscribe(syms);
    },
    [send, priceStoreSubscribe],
  );

  const unsubscribe = useCallback(
    (syms: string[]) => {
      send({ type: "unsubscribe", symbols: syms });
      priceStoreUnsubscribe(syms);
    },
    [send, priceStoreUnsubscribe],
  );

  useEffect(() => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!enabled) {
      return;
    }

    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function scheduleReconnect() {
      clearReconnectTimer();
      if (retriesRef.current >= MAX_RETRIES) {
        return;
      }
      retriesRef.current += 1;
      const delay = backoffRef.current;
      reconnectTimerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        connect();
      }, delay);
    }

    function connect() {
      const token = useAuthStore.getState().accessToken;
      const wsUrl = token
        ? `${url}?token=${encodeURIComponent(token)}`
        : url;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        backoffRef.current = 1_000;
        retriesRef.current = 0;
        if (symbolsRef.current.length > 0) {
          send({ type: "subscribe", symbols: symbolsRef.current });
          priceStoreSubscribe(symbolsRef.current);
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          if (msg.type === "price") {
            const update = msg as WsPriceUpdate;
            setPrice(update.symbol, {
              symbol: update.symbol,
              price: update.price,
              volume: update.volume,
              timestamp: update.timestamp,
            });
          }
        } catch {
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [url, enabled, setPrice, send, priceStoreSubscribe]);

  return { isConnected, subscribe, unsubscribe };
}
