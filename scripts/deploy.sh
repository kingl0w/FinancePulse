#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo -e "${GREEN}  FinancePulse Deploy${NC}"
echo ""

# Check .env
if [ ! -f .env ]; then
    echo "ERROR: .env file not found. Copy .env.example and fill in values."
    exit 1
fi

# Pull latest code
info "Pulling latest code..."
git pull origin main 2>/dev/null || warn "Git pull skipped (not on main or no remote)"

# Build and start
info "Building containers..."
docker compose build

info "Starting services..."
docker compose up -d

# Wait for DB
info "Waiting for database..."
for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U financepulse >/dev/null 2>&1; then
        info "Database ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        warn "Database did not become ready in 30s — check logs."
        docker compose logs db --tail 10
        exit 1
    fi
    sleep 1
done

# Seed (safe to re-run)
info "Running seed..."
docker compose exec -T backend seed 2>/dev/null || warn "Seed skipped or already seeded."

echo ""
echo -e "${GREEN}  FinancePulse deployed!${NC}"
echo ""
echo "  Frontend:  http://localhost (or via Cloudflare Tunnel)"
echo "  API:       http://localhost/api"
echo "  WebSocket: ws://localhost/ws"
echo ""

docker compose ps
