'use strict'

const {
  LoggerProvider,
  SimpleLogRecordProcessor,
  BatchLogRecordProcessor
} = require('@opentelemetry/sdk-logs')
const api = require('@opentelemetry/api')

const { SeverityNumber, logs } = require('@opentelemetry/api-logs') // TODO: optional import
const {
  Resource,
  detectResourcesSync,
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetector
} = require('@opentelemetry/resources')

const DEFAULT_MESSAGE_KEY = 'msg'

// TODO: BatchLogRecordProcessor should be configurable with https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#batch-logrecord-processor
// which implements this spec https://opentelemetry.io/docs/specs/otel/logs/sdk/#batching-processor
// and is implemented here https://github.com/open-telemetry/opentelemetry-js/blob/48fb15862e801b742059a3e39dbcc8ef4c10b2e2/experimental/packages/sdk-logs/src/export/BatchLogRecordProcessorBase.ts#L47C1-L47C1
//
//
// TODO: document the ability for user to provide one's own LogRecorProcesor https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecordprocessor
//
// TODO: document thow the user can create a MultiLogProcessor if they need to use multiple exporters https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/sdk-logs/src/MultiLogRecordProcessor.ts
// TODO: use MultiLogRecordProcessor to support multiple exporters as an implementation detail as the sdk does not export that
//
//
// All env vars are defined here: https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/src/utils/environment.ts#L135
// We might want to read this env var https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/src/utils/environment.ts#L138
// order: OTEL_EXPORTER_OTLP_LOGS_PROTOCOL ?? OTEL_EXPORTER_OTLP_PROTOCOL ?? options.exporterProtocol
//
//
// TODO: add this chunk to REAMDE "Settings configured programmatically take precedence over environment variables. Per-signal environment variables take precedence over non-per-signal environment variables."
//

/**
 * @typedef {Object} Options
 * @property {string} loggerName
 * @property {string} serviceVersion
 * @property {Object} [resourceAttributes={}]
 * @property {import('@opentelemetry/sdk-logs').LogRecordProcessor} [logRecordProcessor]
 * @property {LogRecordProcessorOptions} [logRecordProcessorOptions]
 * @property {string} [messageKey="msg"]
 *
 * @param {Options} opts
 */
function getOtlpLogger (opts) {
  const detectedResource = detectResourcesSync({
    detectors: [
      envDetectorSync,
      hostDetectorSync,
      osDetectorSync,
      processDetector
    ]
  })
  const loggerProvider = new LoggerProvider({
    resource: detectedResource.merge(
      new Resource({ ...opts.resourceAttributes })
    )
  })

  const recordProcessor =
    opts.logRecordProcessor ??
    createLogRecordProcessor(opts.logRecordProcessorOptions)

  loggerProvider.addLogRecordProcessor(recordProcessor)

  logs.setGlobalLoggerProvider(loggerProvider)

  const logger = logs.getLogger(opts.loggerName, opts.serviceVersion)

  const mapperOptions = {
    messageKey: opts.messageKey || DEFAULT_MESSAGE_KEY
  }

  return {
    /**
     * @param {Bindings} obj
     */
    emit (obj) {
      logger.emit(toOpenTelemetry(obj, mapperOptions))
    },
    async shutdown () {
      return loggerProvider.shutdown()
    }
  }
}

/**
 * @typedef {"batch" | "simple"} RecordProcessorType
 * @typedef {Object} LogRecordProcessorOptions
 * @property {RecordProcessorType} recordProcessorType = "batch"
 * @property {ExporterOptions} [exporterOptions]
 * @property {import('@opentelemetry/sdk-logs').BufferConfig} exporterConfig
 *
 * @param {LogRecordProcessorOptions} opts
 * @returns {import('@opentelemetry/sdk-logs').LogRecordProcessor}
 */
function createLogRecordProcessor (opts) {
  const exporter = createExporter(opts?.exporterOptions)

  if (opts?.recordProcessorType === 'simple') {
    return new SimpleLogRecordProcessor(exporter)
  }

  return new BatchLogRecordProcessor(exporter)
}

/**
 * @typedef {Object} GrpcExporterOptions
 * @property {"grpc"} protocol
 * @property {import('@opentelemetry/otlp-grpc-exporter-base').OTLPGRPCExporterConfigNode} [grpcExporterOptions]
 *
 * @typedef {Object} HttpExporterOptions
 * @property {"http"} protocol
 * @property {import('@opentelemetry/otlp-exporter-base').OTLPExporterNodeConfigBase} [httpExporterOptions]
 *
 * @typedef {Object} ProtobufExporterOptions
 * @property {"http/protobuf"} protocol
 * @property {import('@opentelemetry/otlp-exporter-base').OTLPExporterNodeConfigBase} [protobufExporterOptions]
 *
 * @typedef {GrpcExporterOptions | HttpExporterOptions | ProtobufExporterOptions} ExporterOptions
 *
 * @param {ExporterOptions} exporterOptions
 * @returns {import('@opentelemetry/sdk-logs').LogRecordExporter}
 */
function createExporter (exporterOptions) {
  const exporterProtocol =
    exporterOptions?.protocol ??
    process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL ??
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL

  if (exporterProtocol === 'grpc') {
    const {
      OTLPLogExporter
    } = require('@opentelemetry/exporter-logs-otlp-grpc')
    return new OTLPLogExporter(exporterOptions?.grpcExporterOptions)
  }

  if (exporterProtocol === 'http') {
    const {
      OTLPLogExporter
    } = require('@opentelemetry/exporter-logs-otlp-http')
    return new OTLPLogExporter(exporterOptions?.httpExporterOptions)
  }

  const {
    OTLPLogsExporter,
    OTLPLogExporter
  } = require('@opentelemetry/exporter-logs-otlp-proto')

  if (typeof OTLPLogExporter === 'function') {
    return new OTLPLogExporter(exporterOptions?.protobufExporterOptions)
  }

  // TODO: remove this once https://github.com/open-telemetry/opentelemetry-js/issues/3812#issuecomment-1713830883 is resolved
  return new OTLPLogsExporter(exporterOptions?.protobufExporterOptions)
}

/**
 * If the source format has only a single severity that matches the meaning of the range
 * then it is recommended to assign that severity the smallest value of the range.
 * https://github.com/open-telemetry/opentelemetry-specification/blob/fc8289b8879f3a37e1eba5b4e445c94e74b20359/specification/logs/data-model.md#mapping-of-severitynumber
 */
const SEVERITY_NUMBER_MAP = {
  10: SeverityNumber.TRACE,
  20: SeverityNumber.DEBUG,
  30: SeverityNumber.INFO,
  40: SeverityNumber.WARN,
  50: SeverityNumber.ERROR,
  60: SeverityNumber.FATAL
}

// https://github.com/open-telemetry/opentelemetry-specification/blob/fc8289b8879f3a37e1eba5b4e445c94e74b20359/specification/logs/data-model.md#displaying-severity
const SEVERITY_NAME_MAP = {
  1: 'TRACE',
  2: 'TRACE2',
  3: 'TRACE3',
  4: 'TRACE4',
  5: 'DEBUG',
  6: 'DEBUG2',
  7: 'DEBUG3',
  8: 'DEBUG4',
  9: 'INFO',
  10: 'INFO2',
  11: 'INFO3',
  12: 'INFO4',
  13: 'WARN',
  14: 'WARN2',
  15: 'WARN3',
  16: 'WARN4',
  17: 'ERROR',
  18: 'ERROR2',
  19: 'ERROR3',
  20: 'ERROR4',
  21: 'FATAL',
  22: 'FATAL2',
  23: 'FATAL3',
  24: 'FATAL4'
}

/**
 * @typedef {Object} CommonBindings
 * @property {string=} msg
 * @property {number=} level
 * @property {number=} time
 * @property {string=} hostname
 * @property {number=} pid
 *
 * @typedef {Record<string, string | number | Object> & CommonBindings} Bindings
 *
 */

/**
 * Converts a pino log object to an OpenTelemetry log object.
 *
 * @typedef {Object} MapperOptions
 * @property {string} messageKey
 *
 * @param {Bindings} sourceObject
 * @param {MapperOptions} mapperOptions
 * @returns {import('@opentelemetry/api-logs').LogRecord}
 */
function toOpenTelemetry (sourceObject, { messageKey }) {
  const {
    time,
    level,
    hostname,
    pid,
    [messageKey]: msg,
    ...rawAttributes
  } = sourceObject

  const severityNumber =
    SEVERITY_NUMBER_MAP[sourceObject.level] ?? SeverityNumber.UNSPECIFIED
  const severityText = SEVERITY_NAME_MAP[severityNumber] ?? 'UNSPECIFIED'

  let context = api.context.active()
  /* eslint-disable camelcase */
  const { trace_id, span_id, trace_flags, ...attributes } = rawAttributes

  if (
    typeof trace_id !== 'undefined' &&
    typeof span_id !== 'undefined' &&
    typeof trace_flags !== 'undefined'
  ) {
    context = api.trace.setSpanContext(context, {
      traceId: trace_id,
      spanId: span_id,
      traceFlags: trace_flags,
      isRemote: true
    })
  }
  /* eslint-enable camelcase */

  return {
    timestamp: time,
    body: msg,
    severityNumber,
    attributes,
    severityText,
    context
  }
}

module.exports = {
  getOtlpLogger
}
