.PHONY: help setup up down restart status logs \
       infra infra-down \
       build deploy deploy-api deploy-web deploy-worker \
       dev dev-api dev-web dev-worker \
       db-generate db-migrate db-push db-studio db-seed \
       typecheck test test-e2e storybook \
       clean clean-volumes

# ──────────────────────────────────────────────
# Defaults
# ──────────────────────────────────────────────
COMPOSE := docker compose
INFRA   := postgres redis minio temporal temporal-db temporal-ui searxng
APPS    := api web worker

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
# Quick start
# ──────────────────────────────────────────────
setup: ## Start infra, wait for postgres, run migrations, and seed
	$(COMPOSE) up -d $(INFRA)
	@echo "Waiting for postgres to be healthy..."
	@until $(COMPOSE) exec -T postgres pg_isready -U nova > /dev/null 2>&1; do sleep 1; done
	@echo "Postgres ready. Running migrations..."
	bun run db:migrate
	@echo "Seeding database..."
	bun run --filter @nova/api db:seed
	@echo "Done! Run 'make dev' for local dev or 'make deploy' for Docker."

# ──────────────────────────────────────────────
# Full environment
# ──────────────────────────────────────────────
up: ## Start everything (infra + apps)
	$(COMPOSE) up -d

down: ## Stop everything
	$(COMPOSE) down

restart: ## Restart everything
	$(COMPOSE) restart

status: ## Show container status
	$(COMPOSE) ps

logs: ## Tail all logs (use SERVICE=api to filter)
ifdef SERVICE
	$(COMPOSE) logs -f $(SERVICE)
else
	$(COMPOSE) logs -f
endif

# ──────────────────────────────────────────────
# Infrastructure only
# ──────────────────────────────────────────────
infra: ## Start infrastructure services only (postgres, redis, minio, temporal, searxng)
	$(COMPOSE) up -d $(INFRA)

infra-down: ## Stop infrastructure services only
	$(COMPOSE) stop $(INFRA)

# ──────────────────────────────────────────────
# Build & deploy (Docker)
# ──────────────────────────────────────────────
build: ## Build all app containers
	$(COMPOSE) build $(APPS)

deploy: build ## Build and start all app containers
	$(COMPOSE) up -d $(APPS)

deploy-api: ## Build and start API container
	$(COMPOSE) build api && $(COMPOSE) up -d api

deploy-web: ## Build and start Web container
	$(COMPOSE) build web && $(COMPOSE) up -d web

deploy-worker: ## Build and start Worker container
	$(COMPOSE) build worker && $(COMPOSE) up -d worker

# ──────────────────────────────────────────────
# Local development (bun)
# ──────────────────────────────────────────────
dev: ## Run all packages locally (bun)
	bun run dev

dev-api: ## Run API locally
	bun run dev:api

dev-web: ## Run Web locally
	bun run dev:web

dev-worker: ## Run Worker locally
	bun run dev:worker

# ──────────────────────────────────────────────
# Database
# ──────────────────────────────────────────────
db-generate: ## Generate Drizzle migration files
	bun run db:generate

db-migrate: ## Apply database migrations
	bun run db:migrate

db-push: ## Push schema directly (dev shortcut)
	bun run db:push

db-studio: ## Open Drizzle Studio
	bun run db:studio

db-seed: ## Seed the database
	bun run --filter @nova/api db:seed

# ──────────────────────────────────────────────
# Quality
# ──────────────────────────────────────────────
typecheck: ## Run TypeScript type checking
	bun run typecheck

test: ## Run all tests
	bun test

test-e2e: ## Run Playwright E2E tests
	bunx playwright test

storybook: ## Start Storybook dev server
	bun run storybook

# ──────────────────────────────────────────────
# Cleanup
# ──────────────────────────────────────────────
clean: down ## Stop everything and remove containers
	$(COMPOSE) rm -f

clean-volumes: down ## Stop everything and remove containers + volumes (⚠ destroys data)
	$(COMPOSE) down -v
