#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─── Check prerequisites ──────────────────────────────────
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || error "Docker is not installed. Install it from https://docs.docker.com/get-docker/"

if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    error "Docker Compose is not installed."
fi
info "Docker Compose found: $COMPOSE"

if command -v rustc >/dev/null 2>&1; then
    info "Rust toolchain found: $(rustc --version)"
else
    warn "Rust toolchain not found. Required only for local (non-Docker) backend development."
fi

if command -v node >/dev/null 2>&1; then
    info "Node.js found: $(node --version)"
else
    warn "Node.js not found. Required only for local (non-Docker) frontend development."
fi

# ─── Setup .env file ──────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f .env ]; then
    warn ".env file already exists. Skipping creation."
else
    info "Creating .env from .env.example..."
    cp .env.example .env

    # Generate random JWT secrets
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')

    sed -i "s|JWT_SECRET=change-me-to-a-random-secret|JWT_SECRET=${JWT_SECRET}|" .env
    sed -i "s|JWT_REFRESH_SECRET=change-me-to-another-random-secret|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" .env

    # Generate a random Postgres password
    PG_PASS=$(openssl rand -base64 24 | tr -d '\n')
    sed -i "s|POSTGRES_PASSWORD=changeme|POSTGRES_PASSWORD=${PG_PASS}|" .env

    info "Generated random JWT secrets and database password."

    # Prompt for Finnhub API key
    echo ""
    echo -e "${YELLOW}Finnhub API key (free at https://finnhub.io):${NC}"
    read -rp "  FINNHUB_API_KEY (leave blank to skip): " FINNHUB_KEY

    if [ -n "$FINNHUB_KEY" ]; then
        sed -i "s|^FINNHUB_API_KEY=.*|FINNHUB_API_KEY=${FINNHUB_KEY}|" .env
    fi

    read -rp "  ALPHA_VANTAGE_KEY (leave blank to skip): " AV_KEY
    if [ -n "$AV_KEY" ]; then
        sed -i "s|^ALPHA_VANTAGE_KEY=.*|ALPHA_VANTAGE_KEY=${AV_KEY}|" .env
    fi

    info ".env file configured."
fi

# ─── Start database and Redis ────────────────────────────
echo ""
info "Starting PostgreSQL and Redis..."
$COMPOSE up -d db redis

info "Waiting for PostgreSQL to be ready..."
until $COMPOSE exec db pg_isready -U financepulse >/dev/null 2>&1; do
    sleep 1
done
info "PostgreSQL is ready."

# ─── Run migrations ──────────────────────────────────────
if command -v sqlx >/dev/null 2>&1; then
    info "Running database migrations..."
    source .env
    export DATABASE_URL="postgres://${POSTGRES_USER:-financepulse}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB:-financepulse}"
    cd backend && sqlx migrate run && cd ..
    info "Migrations complete."
else
    warn "sqlx-cli not found. Install with: cargo install sqlx-cli --no-default-features --features rustls,postgres"
    warn "Then run migrations manually: make migrate"
fi

# ─── Done ─────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  FinancePulse setup complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo "    make dev    — Start all services in development mode"
echo "    make up     — Start all services in production mode"
echo "    make logs   — Follow container logs"
echo ""
echo "  Frontend:  http://localhost:3003"
echo "  Backend:   http://localhost:8080"
echo "  Postgres:  localhost:5432 (dev mode)"
echo "  Redis:     localhost:6379 (dev mode)"
echo ""
