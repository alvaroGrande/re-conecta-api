import pino from "pino";
import { LOG_CONFIG } from "./config.js";
const isDev = process.env.NODE_ENV !== "production";
const otelEnabled = process.env.OTEL_ENABLED === 'true';
const {LEVEL, PRETTY_PRINT} = LOG_CONFIG;

const transports = [];

if (isDev) {
  transports.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd/mm/yyyy HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{msg}',
    },
  });
}

if (otelEnabled) {
  transports.push({
    target: 'pino-opentelemetry-transport',
    options: {
      resourceAttributes: {
        'service.name': process.env.OTEL_SERVICE_NAME || 're-conectaapi',
      },
    },
  });
}

const logger = pino({
  level: LEVEL || 'info',
  transport: transports.length > 0
    ? { targets: transports }
    : undefined,
});

export default logger;