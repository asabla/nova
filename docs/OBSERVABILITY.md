# Observability Guide

Monitoring, tracing, and log exploration for the Nova platform.

All observability services run under the `observability` Docker Compose profile. Nothing is enabled by default — you opt in when you need it.

---

## Quick Start

```bash
make observability
```

This starts Grafana, Prometheus, Loki, Tempo, Alloy, and all exporters. Once containers are healthy:

- **Grafana**: http://localhost:3002 (anonymous access with Editor role, no login required)
- **Prometheus**: http://localhost:9090 (direct metric queries)

Grafana ships with pre-configured datasources (Prometheus, Loki, Tempo) and 7 dashboards. No setup needed.

To stop:

```bash
docker compose --profile observability down
```

---

## Dashboards

Open Grafana at http://localhost:3002 and go to **Dashboards**. Seven dashboards are pre-built:

### Nova Platform Overview

The primary operational dashboard. Panels:

| Panel | What to look for |
|-------|-----------------|
| Request Rate | Sudden drops = service down, spikes = traffic burst or bot |
| Error Rate (5xx) | Anything above 1% sustained needs investigation |
| Request Latency (p50/p95/p99) | p95 above 2s on non-LLM routes is abnormal |
| Active WebSocket Connections | Should correlate with logged-in users |
| Active Streaming Requests | Long-lived SSE connections for chat responses |
| LLM Token Usage | Tracks token consumption across providers |
| Workflows Dispatched | Temporal workflow starts (agent, ingestion, background) |

### Nova PostgreSQL

Sourced from `postgres-exporter` scraping the Nova database.

| Panel | Healthy range |
|-------|--------------|
| Active Connections | Well below `max_connections` (default 100) |
| Database Size | Steady growth; sudden jumps = large ingestion batch |
| Cache Hit Ratio | Should be above 99%. Below 95% = needs more `shared_buffers` |
| Transactions/sec | Baseline varies; watch for sudden drops |
| Deadlocks | Must be 0. Any deadlock needs immediate investigation |

### Nova Redis

Sourced from `redis-exporter`.

| Panel | Healthy range |
|-------|--------------|
| Memory Used | Below `maxmemory` setting |
| Connected Clients | Stable count matching service instances |
| Ops/sec | Baseline depends on load; watch for flatline (service disconnected) |
| Keyspace Hit Ratio | Above 90%. Low ratio = missing keys, possible cold cache |
| Evictions | Should be 0 under normal load. Non-zero = memory pressure |

### Nova Qdrant

Vector search metrics.

| Panel | Notes |
|-------|-------|
| Collections | Number of active vector collections |
| Total Vectors | Growth tracks document ingestion |
| REST/gRPC Request Rate | Search and upsert operations |
| Request Latency | Search p95 above 500ms = collection needs optimization |

### Nova RustFS

S3-compatible storage metrics.

| Panel | Notes |
|-------|-------|
| Total Storage Used | File attachments, exports, skill artifacts |
| Object Count | Correlates with uploaded files |
| S3 Request Rate | GET (downloads/previews) vs PUT (uploads) |
| Network Traffic | Watch for unusual egress spikes |

### Nova Temporal

Workflow orchestration health.

| Panel | Notes |
|-------|-------|
| Service Request Rate | Workflow starts + activity completions |
| Service Errors | Non-zero = workflow failures, check Temporal UI at :8233 |
| Persistence Latency | Above 100ms = Temporal DB under pressure |
| SQL Connection Pool | Exhausted pool = Temporal stalls, workflows queue up |

### Nova Nginx

Reverse proxy metrics from both web and admin exporters.

| Panel | Notes |
|-------|-------|
| Active Connections (web) | Client connections to the main app |
| Active Connections (admin) | Admin portal connections (usually low) |
| Request Rate | Combined HTTP request throughput |

---

## Traces

Distributed tracing is powered by Tempo. Applications send traces via OTLP to Alloy, which forwards to Tempo.

### Exploring traces

1. Open Grafana, go to **Explore**
2. Select the **Tempo** datasource
3. Use the **Search** tab

Common searches:

| Find | How |
|------|-----|
| All API requests | Service Name = `nova-api` |
| Slow requests | Service Name = `nova-api`, Duration > `2s` |
| Agent executions | Span Name = `agent.run` |
| Tool invocations | Span Name contains `tool.` |
| Specific operation | Span Name = `POST /api/conversations/:id/messages` |

### Look up a trace by ID

Every API response includes an `X-Request-Id` header that doubles as the trace ID.

1. In Grafana Explore, select **Tempo**
2. Switch to the **TraceQL** tab
3. Enter the trace ID directly in the search bar

From curl:

```bash
curl -v http://localhost:3000/api/health 2>&1 | grep x-request-id
# x-request-id: abc123def456
# Paste abc123def456 into Tempo search
```

### Trace structure

A typical chat message trace looks like:

```
POST /api/conversations/:id/messages (nova-api)
  +-- temporal.workflow.start
  +-- agent.run (nova-worker-agent)
  |     +-- llm.call (provider: anthropic, model: claude-...)
  |     +-- tool.execute (tool: web_search)
  |     +-- llm.call (provider: anthropic, model: claude-...)
  +-- stream.done
```

**Fire-and-forget workflows** (research, ingestion, background tasks) will show a short API span that ends after dispatching to Temporal. The actual work appears as a separate trace from the worker.

### Trace-to-logs

When viewing a trace, click **Logs for this span** to jump to Loki filtered by that trace's time range and service. This works because Alloy attaches container labels to both traces and logs.

---

## Logs

All Docker container logs are tailed by Alloy and shipped to Loki. No application-side configuration required.

### Querying logs

In Grafana Explore, select the **Loki** datasource. Queries use LogQL.

**All Nova services:**

```logql
{container=~"nova-.*"} | json
```

**Single service:**

```logql
{container="nova-api"} | json
```

```logql
{container="nova-worker-agent"} | json
```

```logql
{container="nova-worker-ingestion"} | json
```

**Filter by log level:**

```logql
{container=~"nova-.*"} | json | level="error"
```

**Search for a specific trace ID:**

```logql
{container=~"nova-.*"} |= "abc123def456"
```

**Nginx logs** (separate containers for web and admin):

```logql
{container="nova-nginx-web"} | json
```

```logql
{container="nova-nginx-admin"} | json
```

### Useful log queries

| Scenario | Query |
|----------|-------|
| All errors in the last hour | `{container=~"nova-.*"} \| json \| level="error"` |
| Failed LLM calls | `{container="nova-worker-agent"} \|= "llm" \|= "error"` |
| Slow DB queries | `{container="nova-api"} \|= "slow query"` |
| Workflow failures | `{container=~"nova-worker-.*"} \|= "workflow failed"` |
| Auth failures | `{container="nova-api"} \|= "unauthorized"` |
| Specific user activity | `{container="nova-api"} \| json \| userId="usr_xxx"` |

---

## Metrics

Prometheus scrapes 8 targets. Key application metrics exported by `nova-api`:

### HTTP

| Metric | Type | Description |
|--------|------|-------------|
| `nova_http_requests_total` | Counter | Total HTTP requests by method, route, status |
| `nova_http_request_duration_seconds` | Histogram | Request latency by method, route |

Example PromQL — error rate percentage:

```promql
rate(nova_http_requests_total{status=~"5.."}[5m])
/ rate(nova_http_requests_total[5m]) * 100
```

### WebSocket and Streaming

| Metric | Type | Description |
|--------|------|-------------|
| `nova_ws_connections_active` | Gauge | Current open WebSocket connections |
| `nova_streaming_requests_active` | Gauge | Current SSE streaming responses |

### LLM and Workflows

| Metric | Type | Description |
|--------|------|-------------|
| `nova_llm_tokens_total` | Counter | Token usage by provider, model, direction (input/output) |
| `nova_workflows_dispatched_total` | Counter | Temporal workflows started by type (agent, ingestion, background) |
| `nova_errors_total` | Counter | Application errors by category |

### Infrastructure metrics (from exporters)

| Target | Example metrics |
|--------|----------------|
| postgres-exporter | `pg_stat_activity_count`, `pg_database_size_bytes`, `pg_stat_bgwriter_buffers_backend` |
| redis-exporter | `redis_memory_used_bytes`, `redis_connected_clients`, `redis_commands_processed_total` |
| nginx-exporter-web | `nginx_connections_active`, `nginx_http_requests_total` |
| nginx-exporter-admin | `nginx_connections_active`, `nginx_http_requests_total` |

Prometheus also scrapes Temporal, Qdrant, and RustFS natively (they expose `/metrics` endpoints).

---

## Alerting

Pre-configured alert rules fire in Grafana. Check active alerts at **Alerting > Alert rules** in the Grafana sidebar.

### Default alert rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | 5xx rate > 5% for 5 minutes | Critical |
| High Latency | p95 latency > 5s for 5 minutes | Warning |
| Workflow Failures | Workflow error rate > 10% for 10 minutes | Warning |
| High Memory Usage | Container memory > 90% limit for 5 minutes | Warning |
| PostgreSQL Deadlock | Any deadlock detected | Critical |
| Redis Memory Pressure | Evictions > 0 for 5 minutes | Warning |
| Qdrant Unhealthy | Collection status != green | Critical |

### Adding notification channels

By default, alerts appear only in the Grafana UI. To send notifications:

1. Go to **Alerting > Contact points**
2. Add a contact point (Slack webhook, email, PagerDuty, etc.)
3. Update the **Notification policy** to route alerts to your contact point

---

## Enterprise Export

For production deployments that use external observability platforms, Alloy can forward signals via OTLP.

### Datadog

Add to your Alloy configuration:

```alloy
otelcol.exporter.otlphttp "datadog" {
  client {
    endpoint = "https://api.datadoghq.com"
    headers  = { "DD-API-KEY" = env("DD_API_KEY") }
  }
}
```

### Splunk

```alloy
otelcol.exporter.otlphttp "splunk" {
  client {
    endpoint = "https://ingest.splunk.example.com/v1"
    headers  = { "X-SF-Token" = env("SPLUNK_TOKEN") }
  }
}
```

### Generic OTLP endpoint

Any OTLP-compatible backend (Honeycomb, Lightstep, New Relic, etc.):

```alloy
otelcol.exporter.otlp "external" {
  client {
    endpoint = env("EXTERNAL_OTLP_ENDPOINT")
  }
}
```

Wire the exporter into the existing Alloy pipeline by adding it to the `otelcol.processor.batch` output list.

---

## Environment Variables

Set these in `.env` or pass via Docker Compose:

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry instrumentation in Nova services |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://alloy:4318` | OTLP HTTP endpoint (Alloy receives on 4317/gRPC, 4318/HTTP) |
| `OTEL_SERVICE_NAME` | Per service | Overrides the auto-detected service name |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password (anonymous Editor access is enabled by default) |

To enable tracing in development:

```bash
# .env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Then restart the services you want to trace.

---

## Architecture

Signal flow through the observability stack:

```
+-------------------+     +-------------------+     +-------------------+
|    nova-api       |     | nova-worker-agent |     | nova-worker-*     |
|  (metrics, traces,|     | (traces, logs)    |     | (traces, logs)    |
|   logs)           |     |                   |     |                   |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                          |
         |  OTLP (traces)         |  OTLP (traces)          |  OTLP (traces)
         |  stdout (logs)         |  stdout (logs)          |  stdout (logs)
         |  /metrics (pull)       |                          |
         v                        v                          v
+--------+--------------------------------------------------------+
|                        Grafana Alloy                             |
|  - Tails Docker container logs --> Loki                         |
|  - Receives OTLP traces        --> Tempo                        |
|  - Receives OTLP metrics        --> Prometheus (remote write)   |
+-----------+--------------------+--------------------+-----------+
            |                    |                    |
            v                    v                    v
      +-----+------+     +------+-----+     +-------+------+
      |    Loki     |     |   Tempo    |     | Prometheus   |
      |   :3100     |     |   :3200    |     |   :9090      |
      | (logs)      |     | (traces)   |     | (metrics)    |
      +-----+-------+     +------+-----+     +--+-----+----+
            |                    |               |     |
            +--------------------+---------------+     |
                                 |                     |
                          +------+------+              |
                          |   Grafana   |              |
                          |    :3002    +--------------+
                          | (dashboards,|  Prometheus also scrapes:
                          |  explore,   |  - postgres-exporter
                          |  alerting)  |  - redis-exporter
                          +-------------+  - nginx-exporter-web
                                           - nginx-exporter-admin
                                           - temporal :9090
                                           - qdrant :6333
                                           - minio :9000
```

### Scrape targets

Prometheus is configured to scrape these targets at 15s intervals:

| Target | Endpoint | Metrics |
|--------|----------|---------|
| nova-api | `nova-api:3000/metrics` | Application metrics |
| postgres-exporter | `postgres-exporter:9187/metrics` | PostgreSQL stats |
| redis-exporter | `redis-exporter:9121/metrics` | Redis stats |
| nginx-exporter-web | `nginx-exporter-web:9113/metrics` | Web proxy stats |
| nginx-exporter-admin | `nginx-exporter-admin:9113/metrics` | Admin proxy stats |
| temporal | `temporal:9090/metrics` | Workflow engine stats |
| qdrant | `qdrant:6333/metrics` | Vector DB stats |
| minio | `minio:9000/minio/v2/metrics/cluster` | Object storage stats |

---

## Runbooks

### "I got a 500 error"

1. Note the `X-Request-Id` from the response header
2. Open Grafana Explore with Tempo, paste the trace ID
3. Inspect the trace for the failing span and its error message
4. Click "Logs for this span" to see surrounding log context
5. Check the **Nova Platform Overview** dashboard for broader error rate trends

### "Chat responses are slow"

1. Open the **Nova Platform Overview** dashboard, check latency panels
2. If API latency is normal but chat feels slow, the bottleneck is LLM provider response time (visible in trace spans as `llm.call` duration)
3. If API latency is high, check **PostgreSQL** dashboard for connection saturation or deadlocks
4. Check **Redis** dashboard for evictions or high memory (stream relay uses Redis pub/sub)

### "Workflows are stuck"

1. Open the **Temporal** dashboard, check service errors and persistence latency
2. Open Temporal UI at http://localhost:8233, filter by task queue (`nova-agent`, `nova-ingestion`, `nova-background`)
3. Check worker logs: `{container=~"nova-worker-.*"} | json | level="error"`
4. Verify workers are running: `docker compose ps | grep worker`

### "Database is slow"

1. Open the **PostgreSQL** dashboard
2. Check active connections (near max = connection exhaustion)
3. Check cache hit ratio (below 95% = needs tuning)
4. Check for deadlocks (any = code issue, check Temporal workflows for concurrent writes)
5. Logs: `{container="nova-api"} |= "slow query"` or check `pg_stat_statements` directly

### "Vector search is degraded"

1. Open the **Qdrant** dashboard
2. Check request latency (p95 > 500ms is concerning)
3. Check collection count and vector count for unexpected changes
4. Logs: `{container="nova-qdrant"} | json | level="error"`
