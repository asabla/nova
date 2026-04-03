Build, restart, and verify Nova services. Handles the full deployment cycle.

Arguments: $ARGUMENTS
- No arguments = deploy all app services (api, web, admin, workers)
- Specific service name = deploy only that service (e.g., "api", "web", "worker-agent")
- "observability" = rebuild and restart the observability stack

Steps:
1. Build the specified containers: `docker compose build <services>`
2. Set OTEL_ENABLED=true if the observability stack is running
3. Restart: `docker compose up -d <services>`
4. Wait 15 seconds for health checks
5. Verify all restarted services are healthy: `docker compose ps`
6. If API was deployed, hit the health endpoint to confirm: `curl -s http://localhost:3000/health/ready`
7. Report success or failure with container status

For "observability":
1. Stop Grafana: `docker compose --profile observability stop grafana`
2. Remove and recreate: `docker compose --profile observability rm -f grafana && docker volume rm nova_grafana_data`
3. Start full stack: `docker compose --profile observability up -d`
4. Verify all observability services are healthy
