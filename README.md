# FinancePulse

Real-time market intelligence platform built with Rust and Next.js.


## Overview

FinancePulse is a full-featured financial market dashboard that streams real-time price data for stocks, cryptocurrencies, ETFs, and commodities. Built with a Rust (Axum) backend for high-performance WebSocket broadcasting and a Next.js frontend with TradingView charts.

### Features

- **Real-Time Streaming** — Live price updates via WebSocket from Coinbase (crypto) and Finnhub (stocks)
- **115+ Assets** — Stocks, crypto, ETFs, commodities, and forex rates with sortable columns
- **Interactive Charts** — TradingView Lightweight Charts with candlesticks, volume, and technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands)
- **Multi-Chart Grid** — View 2-4 charts simultaneously with independent symbol selection
- **Market Heatmap** — D3.js treemap visualization sized by market cap, colored by 24h performance
- **Prediction Markets** — Live Polymarket data with probability bars and category filtering
- **Portfolio Tracking** — Create portfolios, track holdings with real-time P&L and 30-day performance charts
- **News Aggregation** — Per-symbol and general market news with sentiment analysis (bullish/bearish/neutral)
- **Price Alerts** — Set price targets with direction (above/below) monitoring
- **Symbol Comparison** — Overlay multiple assets on normalized percentage charts
- **Search** — Ctrl+K command palette for quick symbol navigation

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │        Next.js 16 Frontend          │
                    │  TradingView · D3 · shadcn/ui       │
                    │  Zustand · TanStack Query           │
                    └──────┬──────────────────┬───────────┘
                           │ REST             │ WebSocket
                           ▼                  ▼
                    ┌─────────────────────────────────────┐
                    │       Rust Backend (Axum)           │
                    │  JWT Auth · REST API · WS Broadcast │
                    │  Technical Indicators Engine        │
                    ├──────────┬──────────┬───────────────┤
                    │PostgreSQL│  Redis   │  Ingestion    │
                    │  (SQLx)  │ Pub/Sub  │  Coinbase WS  │
                    │          │  Cache   │  Finnhub WS   │
                    │          │          │  CoinGecko    │
                    │          │          │  Yahoo Finance│
                    │          │          │  Polymarket   │
                    └──────────┴──────────┴───────────────┘
```

## Tech Stack

### Backend
- **Rust** with Axum — HTTP framework + WebSocket server
- **PostgreSQL** via SQLx — Compile-time checked queries
- **Redis** — Pub/sub price broadcasting + caching (fred crate)
- **JWT** — Custom auth with argon2 password hashing
- **Tokio** — Async runtime for concurrent data ingestion

### Frontend
- **Next.js 16** — App Router, TypeScript, server/client components
- **TradingView Lightweight Charts** — Candlestick + volume charts
- **D3.js** — Market heatmap treemap
- **Recharts** — Portfolio performance area charts
- **Tailwind CSS + shadcn/ui** — Dark-themed UI components
- **Zustand** — Global state (prices, auth)
- **TanStack Query** — Server state + caching

### Data Sources (All Free Tier)

| Source | Data | Protocol |
|--------|------|----------|
| Coinbase Exchange | Crypto prices (20+ pairs) | WebSocket |
| Finnhub | Stock prices (80+ symbols) | WebSocket + REST |
| CoinGecko | Crypto metadata, sparklines | REST |
| Yahoo Finance | Stock history, metadata | REST |
| Polymarket | Prediction markets (50+) | REST |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Setup

```bash
# Clone
git clone https://github.com/yourusername/financepulse.git
cd financepulse

# Run setup (creates .env, generates secrets)
./scripts/setup.sh

# Edit .env — add your Finnhub API key (free at finnhub.io)
nano .env

# Start all services
docker compose up -d

# Open in browser
open http://localhost:3003
```

### Local Development

```bash
# Start infrastructure
docker compose up -d db redis

# Backend (terminal 1)
cd backend
export DATABASE_URL="postgres://financepulse:$(grep POSTGRES_PASSWORD ../.env | cut -d= -f2)@localhost:5432/financepulse"
cargo run

# Frontend (terminal 2)
cd frontend
npm install
npm run dev

# Open http://localhost:3000
```

## Production Deployment

FinancePulse is designed to run on a single server with Docker Compose and Cloudflare Tunnel.

```bash
# Set production URLs in .env
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws
ALLOWED_ORIGINS=https://yourdomain.com

# Deploy with nginx reverse proxy
./scripts/deploy.sh

# Point Cloudflare Tunnel to localhost:80
```

The nginx proxy routes `/api/*` and `/ws` to the backend, everything else to the frontend.

## API

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market/trending` | All tracked assets (sorted by market cap) |
| GET | `/api/market/:symbol/quote` | Current price quote |
| GET | `/api/market/:symbol/history?range=1M` | Historical OHLCV candles |
| GET | `/api/market/:symbol/indicators?indicators=sma_20,rsi_14` | Technical indicators |
| GET | `/api/market/heatmap` | Heatmap data (market cap + change) |
| GET | `/api/market/compare?symbols=BTC,ETH` | Normalized comparison |
| GET | `/api/market/sparklines` | 7-day sparkline data |
| GET | `/api/market/currencies` | Forex rates |
| GET | `/api/market/search?q=apple` | Symbol search |
| GET | `/api/market/:symbol/news` | Symbol news with sentiment |
| GET | `/api/market/news` | General market news |
| GET | `/api/predictions/trending` | Polymarket prediction markets |
| WS | `/ws` | Real-time price WebSocket |

### Protected Endpoints (JWT)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/portfolio` | List portfolios |
| POST | `/api/portfolio` | Create portfolio |
| GET | `/api/portfolio/:id` | Portfolio detail |
| GET | `/api/portfolio/:id/performance` | P&L with live prices |
| GET | `/api/alerts` | List price alerts |
| POST | `/api/alerts` | Create alert |
| GET | `/api/watchlists` | List watchlists |

### WebSocket

```json
// Subscribe
{ "type": "subscribe", "symbols": ["BTC", "ETH", "AAPL"] }

// Price update (received)
{ "type": "price", "symbol": "BTC", "price": 71093.50, "volume": 1.23, "timestamp": "2026-03-13T..." }
```

## Project Structure

```
financepulse/
├── backend/
│   ├── src/
│   │   ├── main.rs              # Server startup, routing
│   │   ├── auth/                # JWT auth + middleware
│   │   ├── routes/              # REST API handlers
│   │   ├── ws/                  # WebSocket server + broadcast
│   │   ├── ingestion/           # Data feed connectors
│   │   └── models/              # Database models
│   ├── migrations/              # SQL migrations
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js pages (App Router)
│   │   ├── components/          # React components
│   │   ├── hooks/               # useWebSocket, useAuth
│   │   ├── stores/              # Zustand (prices, auth)
│   │   ├── lib/                 # API client, utilities
│   │   └── types/               # TypeScript interfaces
│   └── Dockerfile
├── scripts/                     # Setup and deploy scripts
├── docker-compose.yml           # Production services
├── docker-compose.prod.yml      # Nginx overlay
├── nginx.conf                   # Reverse proxy config
└── .env.example                 # Environment template
```

## License

MIT
