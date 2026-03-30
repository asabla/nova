import pino from "pino";

const env = process.env.NODE_ENV ?? "development";

export const logger = pino({
  level: env === "production" ? "info" : "debug",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
