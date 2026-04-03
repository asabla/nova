Search Nova logs via Loki or Docker. Useful for investigating errors, specific requests, or service behavior.

Arguments: $ARGUMENTS
Format: [service] [filter] — e.g., "api error", "worker-agent traceId:abc123", "all level:error"

Steps:
1. If the observability stack is running (check for nova-loki container), query Loki:
   - Build LogQL query based on arguments:
     - Service filter: `{container="nova-<service>"}` or `{container=~"nova-.*"}` for "all"
     - Level filter: append `| json | level="<level>"` if level specified
     - Text search: append `|= "<search-term>"` for traceId or free text
   - Execute: `docker compose exec loki wget -qO- 'http://localhost:3100/loki/api/v1/query_range' --post-data='query=<LogQL>&limit=20&start=<1h-ago>&end=<now>'`
   - Parse and display results with timestamps, service name, and log content

2. If Loki is not running, fall back to Docker logs:
   - `docker compose logs <service> --tail 50 | grep -i "<filter>"`

3. Present results formatted clearly:
   - Timestamp | Service | Level | Message
   - Highlight errors in the output
   - If a traceId is found, suggest: "Run /diagnose <traceId> for the full trace"

Examples:
- `/logs api error` — Recent API errors
- `/logs worker-agent traceId:abc123` — Logs for a specific trace
- `/logs all level:warn` — Warnings across all services
