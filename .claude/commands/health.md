Check the health of all Nova services. Run all checks and present a clear status summary.

Steps:
1. Check all Docker containers: `docker compose --profile observability ps --format "table {{.Name}}\t{{.Status}}"` — flag any that are not running or unhealthy
2. Hit the API health endpoint: `curl -s http://localhost:3000/health/ready` — check database, Redis, MinIO, Temporal status and latency
3. If the observability stack is running, check Prometheus scrape targets: `docker compose exec prometheus wget -qO- 'http://localhost:9090/api/v1/targets'` — report which targets are UP vs DOWN
4. Check worker containers are running (they don't have health endpoints but should be in "Up" state)

Present results as a clear table:
- Service name | Status | Details (latency, error message, etc.)

Flag any issues prominently and suggest fixes (e.g., "Redis is down — run `docker compose up -d redis`").
