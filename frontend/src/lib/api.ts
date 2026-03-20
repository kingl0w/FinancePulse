import { useAuthStore } from "@/stores/authStore";
import type {
  Alert,
  AuthResponse,
  CreateAlertRequest,
  CreateHoldingRequest,
  Holding,
  HistoricalCandle,
  MarketQuote,
  NewsArticle,
  PerformanceResponse,
  Portfolio,
  PortfolioDetail,
  PortfolioSummary,
  SearchResult,
  UpdateHoldingRequest,
  User,
  Watchlist,
  WatchlistCheckResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

let isRefreshing = false;

class ApiClient {
  private getToken(): string | null {
    return useAuthStore.getState().accessToken;
  }

  private getRefreshToken(): string | null {
    return useAuthStore.getState().refreshToken;
  }

  private async attemptRefresh(): Promise<boolean> {
    const rt = this.getRefreshToken();
    if (!rt || isRefreshing) return false;

    isRefreshing = true;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as AuthResponse;
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isRetry = false
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !isRetry) {
      const refreshed = await this.attemptRefresh();
      if (refreshed) {
        return this.request<T>(method, path, body, true);
      }

      useAuthStore.getState().logout();
      throw new ApiRequestError("Unauthorized", "UNAUTHORIZED");
    }

    if (!res.ok) {
      const errorBody = await res
        .json()
        .catch(() => ({ error: "Request failed", code: "UNKNOWN" }));
      throw new ApiRequestError(
        errorBody.error ?? `HTTP ${res.status}`,
        errorBody.code ?? "UNKNOWN"
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

export class ApiRequestError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

export const api = new ApiClient();

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/login", { email, password });
}

export async function register(
  email: string,
  password: string
): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/register", { email, password });
}

export async function refreshToken(token: string): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/refresh", { refresh_token: token });
}

export async function fetchMe(): Promise<User> {
  return api.get<User>("/auth/me");
}

export async function deleteAccount(): Promise<void> {
  await api.delete("/auth/account");
}

export async function fetchPortfolios(): Promise<PortfolioSummary[]> {
  return api.get<PortfolioSummary[]>("/portfolio");
}

export async function createPortfolio(name: string): Promise<Portfolio> {
  return api.post<Portfolio>("/portfolio", { name });
}

export async function deletePortfolio(id: string): Promise<void> {
  return api.delete(`/portfolio/${id}`);
}

export async function fetchPortfolio(id: string): Promise<PortfolioDetail> {
  return api.get<PortfolioDetail>(`/portfolio/${id}`);
}

export async function fetchPerformance(
  id: string
): Promise<PerformanceResponse> {
  return api.get<PerformanceResponse>(`/portfolio/${id}/performance`);
}

export async function addHolding(
  portfolioId: string,
  body: CreateHoldingRequest
): Promise<Holding> {
  return api.post<Holding>(`/portfolio/${portfolioId}/holdings`, body);
}

export async function updateHolding(
  portfolioId: string,
  holdingId: string,
  body: UpdateHoldingRequest
): Promise<Holding> {
  return api.put<Holding>(
    `/portfolio/${portfolioId}/holdings/${holdingId}`,
    body
  );
}

export async function removeHolding(
  portfolioId: string,
  holdingId: string
): Promise<void> {
  return api.delete(`/portfolio/${portfolioId}/holdings/${holdingId}`);
}

export async function fetchAlerts(): Promise<Alert[]> {
  return api.get<Alert[]>("/alerts");
}

export async function createAlert(body: CreateAlertRequest): Promise<Alert> {
  return api.post<Alert>("/alerts", body);
}

export async function deleteAlert(id: string): Promise<void> {
  return api.delete(`/alerts/${id}`);
}

export async function fetchWatchlists(): Promise<Watchlist[]> {
  return api.get<Watchlist[]>("/watchlists");
}

export async function createWatchlist(name: string): Promise<Watchlist> {
  return api.post<Watchlist>("/watchlists", { name });
}

export async function updateWatchlist(
  id: string,
  data: { name?: string; symbols?: string[] }
): Promise<Watchlist> {
  return api.put<Watchlist>(`/watchlists/${id}`, data);
}

export async function deleteWatchlist(id: string): Promise<void> {
  return api.delete(`/watchlists/${id}`);
}

export async function addToWatchlist(
  watchlistId: string,
  symbol: string
): Promise<Watchlist> {
  return api.post<Watchlist>(`/watchlists/${watchlistId}/symbols`, { symbol });
}

export async function removeFromWatchlist(
  watchlistId: string,
  symbol: string
): Promise<Watchlist> {
  return api.delete<Watchlist>(`/watchlists/${watchlistId}/symbols/${symbol}`);
}

export async function checkWatchlist(
  symbol: string
): Promise<WatchlistCheckResponse> {
  return api.get<WatchlistCheckResponse>(`/watchlists/check/${symbol}`);
}

export async function fetchQuote(symbol: string): Promise<MarketQuote> {
  return api.get<MarketQuote>(`/market/${symbol}/quote`);
}

export async function fetchHistory(
  symbol: string,
  range?: string
): Promise<HistoricalCandle[]> {
  const params = range ? `?range=${encodeURIComponent(range)}` : "";
  return api.get<HistoricalCandle[]>(`/market/${symbol}/history${params}`);
}

export interface IndicatorsResponse {
  symbol: string;
  range: string;
  candles: HistoricalCandle[];
  indicators: Record<string, unknown>;
}

export async function fetchIndicators(
  symbol: string,
  range: string,
  indicators: string[]
): Promise<IndicatorsResponse> {
  const params = new URLSearchParams({ range, indicators: indicators.join(",") });
  return api.get<IndicatorsResponse>(`/market/${symbol}/indicators?${params}`);
}

export interface ComparisonData {
  series: Record<string, Array<{ timestamp: string; pct_change: number }>>;
}

export async function fetchComparison(
  symbols: string[],
  range: string
): Promise<ComparisonData> {
  const params = new URLSearchParams({
    symbols: symbols.join(","),
    range,
  });
  return api.get<ComparisonData>(`/market/compare?${params}`);
}

export async function fetchNews(symbol: string): Promise<NewsArticle[]> {
  return api.get<NewsArticle[]>(`/market/${symbol}/news`);
}

export async function fetchGeneralNews(): Promise<NewsArticle[]> {
  return api.get<NewsArticle[]>("/market/news");
}

export interface PredictionMarket {
  id: string;
  question: string;
  yes_price: number;
  no_price: number;
  volume_24h: number;
  liquidity: number;
  slug: string;
  image: string;
  end_date: string;
  category: string;
}

export async function fetchPredictions(): Promise<PredictionMarket[]> {
  return api.get<PredictionMarket[]>("/predictions/trending");
}

export async function searchMarket(q: string): Promise<SearchResult[]> {
  return api.get<SearchResult[]>(
    `/market/search?q=${encodeURIComponent(q)}`
  );
}

export interface TrendingAsset {
  symbol: string;
  name: string;
  asset_type: string;
  price: number | null;
  change_24h: number | null;
  change_percent_24h: number | null;
  volume: number | null;
  market_cap: number | null;
}

export async function fetchTrending(): Promise<TrendingAsset[]> {
  return api.get<TrendingAsset[]>("/market/trending");
}

export type SparklineData = Record<string, number[]>;

export async function fetchSparklines(): Promise<SparklineData> {
  return api.get<SparklineData>("/market/sparklines");
}

export interface HeatmapEntry {
  symbol: string;
  name: string;
  price: number;
  change_24h: number | null;
  market_cap: number;
  category: string;
}

export async function fetchHeatmap(): Promise<HeatmapEntry[]> {
  return api.get<HeatmapEntry[]>("/market/heatmap");
}

export interface CurrencyEntry {
  pair: string;
  name: string;
  rate: number;
  change_pct: number | null;
  direction: string;
}

export async function fetchCurrencies(): Promise<CurrencyEntry[]> {
  return api.get<CurrencyEntry[]>("/market/currencies");
}
