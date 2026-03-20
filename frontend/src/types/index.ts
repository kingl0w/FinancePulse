export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  holding_count: number;
  created_at: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Holding {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  asset_type: "stock" | "crypto" | "etf" | "commodity" | "index" | "bonds";
  added_at: string;
}

export interface HoldingWithPrice {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  asset_type: "stock" | "crypto" | "etf" | "commodity" | "index" | "bonds";
  added_at: string;
  current_price?: number;
  current_value?: number;
  total_cost: number;
  pnl?: number;
  pnl_percent?: number;
}

export interface PortfolioDetail {
  id: string;
  name: string;
  created_at: string;
  holdings: HoldingWithPrice[];
}

export interface PerformanceResponse {
  total_value: number;
  total_cost: number;
  total_pnl: number;
  total_pnl_percent: number;
  holdings: HoldingWithPrice[];
}

export interface Alert {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  direction: "above" | "below";
  triggered: boolean;
  created_at: string;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  change_24h?: number;
  change_percent_24h?: number;
}

export interface HistoricalCandle {
  symbol: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketQuote {
  symbol: string;
  price: number | null;
  volume?: number;
  change_24h?: number;
  change_percent_24h?: number;
  market_cap?: number;
  source: string;
  stale?: boolean;
  message?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  asset_type: "stock" | "crypto" | "etf" | "commodity" | "index" | "bonds";
}

export interface ApiError {
  error: string;
  code: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface WsSubscribe {
  type: "subscribe";
  symbols: string[];
}

export interface WsUnsubscribe {
  type: "unsubscribe";
  symbols: string[];
}

export interface WsPriceUpdate {
  type: "price";
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
}

export type WsMessage = WsSubscribe | WsUnsubscribe | WsPriceUpdate;

export interface CreatePortfolioRequest {
  name: string;
}

export interface CreateHoldingRequest {
  symbol: string;
  quantity: number;
  avg_cost: number;
  asset_type: "stock" | "crypto" | "etf" | "commodity" | "index" | "bonds";
}

export interface UpdateHoldingRequest {
  quantity?: number;
  avg_cost?: number;
}

export interface CreateAlertRequest {
  symbol: string;
  target_price: number;
  direction: "above" | "below";
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistCheckResponse {
  in_watchlist: boolean;
  watchlist_id: string | null;
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  published_at: string;
  image?: string;
  sentiment: "bullish" | "bearish" | "neutral";
}
