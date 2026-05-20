/**
 * OpenTelemetry — Tracing
 *
 * Cargado antes que cualquier otro módulo via --import en los scripts de npm.
 *
 * Variables de entorno requeridas cuando OTEL_ENABLED=true:
 *   OTEL_SERVICE_NAME                  - Nombre del servicio
 *   OTEL_EXPORTER_OTLP_ENDPOINT        - URL del collector (ej: https://<stack>.grafana.net/otlp)
 *   OTEL_EXPORTER_OTLP_HEADERS         - Cabeceras de auth (ej: Authorization=Basic <token>)
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env    = process.env.NODE_ENV || 'development';
const envMap = { development: '.env.local', qa: '.env.qa', production: '.env.production' };
dotenv.config({ path: resolve(__dirname, '..', envMap[env] || '.env.local') });

if (process.env.OTEL_ENABLED === 'true') {
  const { NodeSDK }                    = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter }          = await import('@opentelemetry/exporter-trace-otlp-http');
  const { diag, DiagConsoleLogger, DiagLogLevel } = await import('@opentelemetry/api');

  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  // OTLPTraceExporter lee OTEL_EXPORTER_OTLP_ENDPOINT y OTEL_EXPORTER_OTLP_HEADERS automáticamente
  // NodeSDK lee OTEL_SERVICE_NAME automáticamente
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs':  { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => sdk.shutdown().finally(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}
