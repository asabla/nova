import { drizzle } from "drizzle-orm/postgres-js";
import { DefaultLogger, type LogWriter } from "drizzle-orm";
import postgres from "postgres";
import { env } from "./env";
import { trace, context, SpanStatusCode } from "@opentelemetry/api";

const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
});

// OTel-instrumented Drizzle logger: creates a span for each query
class OTelLogWriter implements LogWriter {
  write(message: string) {
    const tracer = trace.getTracer("nova-api");
    const span = tracer.startSpan("db.query", {
      attributes: {
        "db.system": "postgresql",
        "db.statement": message.length > 200 ? message.slice(0, 200) + "..." : message,
      },
    }, context.active());
    span.end();
  }
}

export const db = drizzle(client, {
  logger: process.env.OTEL_ENABLED === "true" ? new DefaultLogger({ writer: new OTelLogWriter() }) : undefined,
});
