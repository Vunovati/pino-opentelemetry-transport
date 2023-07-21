'use strict'

// test otlp logger with all possible options
const { getOtlpLogger } = require('../otlp-logger')
const { test } = require('tap')
const { InMemoryLogRecordExporter } = require('@opentelemetry/sdk-logs')

test('otlp logger logs a record in log exporter and maps all log levels correctly', async ({
  match,
  hasStrict,
  same
}) => {
  const exporter = new InMemoryLogRecordExporter()

  const logger = getOtlpLogger({
    loggerName: 'test-logger',
    serviceName: 'test-service',
    serviceVersion: '1.0.0',
    includeTraceContext: true,
    messageKey: 'msg',
    logRecordExporter: exporter,
    useBatchProcessor: false
  })

  const testLogEntryBase = {
    msg: 'test message',
    pid: 123,
    time: 1688655329273,
    hostname: 'test-hostname'
  }

  logger.emit({
    ...testLogEntryBase,
    level: 10
  })
  logger.emit({
    ...testLogEntryBase,
    level: 20
  })
  logger.emit({
    ...testLogEntryBase,
    level: 30
  })
  logger.emit({
    ...testLogEntryBase,
    level: 40
  })
  logger.emit({
    ...testLogEntryBase,
    level: 50
  })
  logger.emit({
    ...testLogEntryBase,
    level: 60
  })
  logger.emit({
    ...testLogEntryBase,
    level: 42
  })

  const records = exporter.getFinishedLogRecords()

  same(records.length, 7)
  match(records[0].hrTime, [16886553292730000, 360000000])
  match(records[0]._severityNumber, 1)
  match(records[0]._severityText, 'TRACE')
  match(records[0]._body, 'test message')
  match(records[0].resource, {
    _attributes: {
      'service.name': 'test-service',
      'telemetry.sdk.language': 'nodejs',
      'telemetry.sdk.name': 'opentelemetry',
      'telemetry.sdk.version': '1.15.0',
      'service.version': '1.0.0'
    }
  })
  match(records[0].instrumentationScope, {
    name: 'test-logger',
    version: '1.0.0'
  })

  match(records[1]._severityNumber, 5)
  match(records[1]._severityText, 'DEBUG')
  match(records[2]._severityNumber, 9)
  match(records[2]._severityText, 'INFO')
  match(records[3]._severityNumber, 13)
  match(records[3]._severityText, 'WARN')
  match(records[4]._severityNumber, 17)
  match(records[4]._severityText, 'ERROR')
  match(records[5]._severityNumber, 21)
  match(records[5]._severityText, 'FATAL')
  // In case of unexpected severity number, the severity number is set to the highest value.
  match(records[6]._severityNumber, 21)
  match(records[6]._severityText, 'FATAL')

  logger.shutdown()

  hasStrict(exporter.getFinishedLogRecords(), [])
})