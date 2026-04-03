Diagnose a Nova request by its trace/request ID. Pull together traces, logs, and span hierarchy to understand what happened.

The request ID is passed as: $ARGUMENTS

Steps:
1. Query Tempo for the trace: `docker compose exec loki wget -qO- 'http://tempo:3200/api/traces/<requestId>'` and parse the span hierarchy showing service, span name, duration, and parent-child relationships
2. Query Loki for related logs: `docker compose exec loki wget -qO- 'http://localhost:3100/loki/api/v1/query_range'` with query `{container=~"nova-.*"} |= "<requestId>"` — use a wide time range (last 1 hour)
3. Present a summary:
   - The full span tree (API → agent.run → tool calls → stream.done)
   - Any error spans or error-level logs
   - Token usage from stream.done span attributes
   - Total request duration
   - Which tools were called and their durations

If the trace is not found, check if Tempo is running and suggest the user verify the request ID from the X-Request-Id response header.
