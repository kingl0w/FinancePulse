.PHONY: dev build up down logs migrate clean backend-shell db-shell prod deploy

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec backend sqlx migrate run --source /app/migrations

clean:
	docker compose down -v

backend-shell:
	docker compose exec backend bash

db-shell:
	docker compose exec db psql -U $${POSTGRES_USER:-financepulse} -d $${POSTGRES_DB:-financepulse}

prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

deploy:
	./scripts/deploy.sh
