Manage the Nova observability stack (Grafana, Prometheus, Loki, Tempo, Alloy, exporters).

Arguments: $ARGUMENTS
- "up" or no arguments — Start the observability stack
- "down" — Stop the observability stack
- "status" — Show status of all observability services and Prometheus scrape targets
- "reset" — Full reset: stop, remove volumes, restart with fresh dashboards

For "up":
1. Run `OTEL_ENABLED=true docker compose --profile observability up -d`
2. Wait 10 seconds, then verify all services are healthy
3. Report Grafana URL: http://localhost:3002

For "down":
1. Run `docker compose --profile observability stop loki tempo grafana-alloy grafana prometheus postgres-exporter redis-exporter nginx-exporter-web nginx-exporter-admin`

For "status":
1. Check container status for all observability services
2. Query Prometheus targets: `docker compose exec prometheus wget -qO- 'http://localhost:9090/api/v1/targets'`
3. Check Grafana dashboards: `docker compose exec loki wget -qO- 'http://grafana:3000/api/search?type=dash-db'`
4. Report: which targets are UP/DOWN, which dashboards are loaded, Grafana URL

For "reset":
1. Stop Grafana and remove its volume for fresh dashboard provisioning
2. Restart the full stack
3. Verify all services and dashboards
