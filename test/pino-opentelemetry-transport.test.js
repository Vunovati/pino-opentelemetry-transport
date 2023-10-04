'use strict'

const { join } = require('path')
const { test, before } = require('tap')
const requireInject = require('require-inject')
const { Wait, GenericContainer } = require('testcontainers')
const { extract } = require('tar-stream')
const { text } = require('node:stream/consumers')
const { setInterval } = require('node:timers/promises')

const LOG_FILE_PATH = '/etc/test-logs/otlp-logs.log'

let container

before(async () => {
  container = await new GenericContainer(
    'otel/opentelemetry-collector-contrib:latest'
  )
    .withCopyFilesToContainer([
      {
        source: join(__dirname, '..', 'otel-collector-config.yaml'),
        target: '/etc/otel-collector-config.yaml'
      }
    ])
    .withExposedPorts({
      container: 4317,
      host: 4317
    })
    .withExposedPorts({
      container: 4318,
      host: 4318
    })
    .withCommand(['--config=/etc/otel-collector-config.yaml'])
    .withWaitStrategy(Wait.forLogMessage('Everything is ready'))
    .withCopyContentToContainer([
      {
        content: '',
        target: LOG_FILE_PATH,
        mode: parseInt('0777', 8)
      }
    ])
    .start()
})

const MOCK_HOSTNAME = 'hostname'

test('translate Pino log format to Open Telemetry data format for each log level', async ({
  same,
  hasStrict
}) => {
  const pino = requireInject.withEmptyCache('pino', {
    os: {
      hostname: () => MOCK_HOSTNAME
    }
  })

  const transport = pino.transport({
    level: 'trace',
    target: '..',
    options: {
      loggerName: 'test-logger-name',
      resourceAttributes: {
        'service.name': 'test-service',
        'service.version': 'test-service-version'
      },
      serviceVersion: 'test-service-version',
      logRecordProcessorOptions: {
        recordProcessorType: 'simple',
        exporterOptions: {
          protocol: 'grpc'
        }
      }
    }
  })

  const logger = pino(transport, {})
  logger.level = 'trace'

  const testTraceId = '12345678901234567890123456789012'
  const testSpanId = '1234567890123456'
  const testTraceFlags = '01'

  const extra = {
    foo: 'bar',
    baz: 'qux',
    /* eslint-disable camelcase */
    trace_id: testTraceId,
    span_id: testSpanId,
    trace_flags: testTraceFlags
    /* eslint-enable camelcase */
  }

  logger.trace(extra, 'test trace')
  logger.debug('test debug')
  logger.info('test info')
  logger.warn('test warn')
  logger.error('test error')
  logger.fatal('test fatal')

  const resource = {
    attributes: [
      {
        key: 'service.name',
        value: {
          stringValue: 'test-service'
        }
      },
      {
        key: 'telemetry.sdk.language',
        value: { stringValue: 'nodejs' }
      },
      {
        key: 'telemetry.sdk.name',
        value: { stringValue: 'opentelemetry' }
      }
    ]
  }

  const scope = {
    name: 'test-logger-name',
    version: 'test-service-version'
  }

  const expectedLines = [
    {
      severityNumber: 1,
      severityText: 'TRACE',
      body: { stringValue: 'test trace' },
      traceId: testTraceId,
      spanId: testSpanId,
      attributes: [
        { key: 'foo', value: { stringValue: 'bar' } },
        { key: 'baz', value: { stringValue: 'qux' } }
      ]
    },
    {
      severityNumber: 5,
      severityText: 'DEBUG',
      body: { stringValue: 'test debug' },
      traceId: '',
      spanId: ''
    },
    {
      severityNumber: 9,
      severityText: 'INFO',
      body: { stringValue: 'test info' },
      traceId: '',
      spanId: ''
    },
    {
      severityNumber: 13,
      severityText: 'WARN',
      body: { stringValue: 'test warn' },
      traceId: '',
      spanId: ''
    },
    {
      severityNumber: 17,
      severityText: 'ERROR',
      body: { stringValue: 'test error' },
      traceId: '',
      spanId: ''
    },
    {
      severityNumber: 21,
      severityText: 'FATAL',
      body: { stringValue: 'test fatal' },
      traceId: '',
      spanId: ''
    }
  ]

  const logs = await container.logs()
  let logRecordReceivedOnCollectorCount = 0

  logs
    .on('data', line => {
      if (line.includes('LogRecord')) {
        logRecordReceivedOnCollectorCount++
      }
    })
    .on('err', line => console.error(line))

  for await (const _ of setInterval(0)) { //eslint-disable-line
    if (logRecordReceivedOnCollectorCount >= expectedLines.length) {
      break
    }
  }

  const stoppedContainer = await container.stop({ remove: false })

  const tarArchiveStream = await stoppedContainer.copyArchiveFromContainer(
    LOG_FILE_PATH
  )

  const extractedArchiveStream = extract()

  tarArchiveStream.pipe(extractedArchiveStream)

  const archivedFileContents = []

  for await (const entry of extractedArchiveStream) {
    const fileContent = await text(entry)
    archivedFileContents.push(fileContent)
  }

  const content = archivedFileContents.join('\n')

  const lines = content.split('\n').filter(Boolean)

  same(lines.length, expectedLines.length, 'correct number of lines')

  lines.forEach(line => {
    hasStrict(JSON.parse(line).resourceLogs?.[0]?.resource, resource)
  })

  lines.forEach(line => {
    hasStrict(JSON.parse(line).resourceLogs?.[0]?.scopeLogs?.[0]?.scope, scope)
  })

  const logRecords = [...lines.entries()]
    .map(([_lineNumber, logLine]) => {
      return JSON.parse(logLine).resourceLogs?.[0]?.scopeLogs?.[0]
        ?.logRecords?.[0]
    })
    .sort((a, b) => {
      return a.severityNumber - b.severityNumber
    })

  for (let i = 0; i < logRecords.length; i++) {
    const logRecord = logRecords[i]
    const expectedLine = expectedLines[i]
    hasStrict(logRecord, expectedLine, `line ${i} is mapped correctly`)
  }
})
