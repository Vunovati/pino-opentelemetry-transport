'use strict'

// test otlp logger with all possible options
const { toOpenTelemetry, DEFAULT_SEVERITY_NUMBER_MAP } = require('../../lib/opentelemetry-mapper')
const { test } = require('tap')
const { SeverityNumber } = require('@opentelemetry/api-logs')
const pino = require('pino')

test('default severity number map', async ({ matchOnlyStrict }) => {
  const pinoLogLevels = pino.levels.values
  matchOnlyStrict(DEFAULT_SEVERITY_NUMBER_MAP, {
    [pinoLogLevels.trace]: SeverityNumber.TRACE,
    [pinoLogLevels.debug]: SeverityNumber.DEBUG,
    [pinoLogLevels.info]: SeverityNumber.INFO,
    [pinoLogLevels.warn]: SeverityNumber.WARN,
    [pinoLogLevels.error]: SeverityNumber.ERROR,
    [pinoLogLevels.fatal]: SeverityNumber.FATAL
  })
})

test('toOpenTelemetry maps all log levels correctly', async ({ matchOnlyStrict }) => {
  const testStart = Date.now()
  const testLogEntryBase = {
    msg: 'test message',
    pid: 123,
    time: testStart,
    hostname: 'test-hostname'
  }

  const testTraceId = '12345678901234567890123456789012'
  const testSpanId = '1234567890123456'
  const testTraceFlags = '01'

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 10,
        trace_id: testTraceId,
        span_id: testSpanId,
        trace_flags: testTraceFlags,
        testAttribute: 'test'
      },
      { messageKey: 'msg' }
    ),
    {
      severityNumber: 1,
      severityText: 'trace',
      body: 'test message',
      timestamp: testStart,
      attributes: {
        testAttribute: 'test',
        span_id: testSpanId,
        trace_id: testTraceId,
        trace_flags: testTraceFlags
      }
    }
  )

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 20
      },
      { messageKey: 'msg' }
    ),
    {
      severityNumber: 5,
      severityText: 'debug',
      body: 'test message',
      timestamp: testStart
    }
  )

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 30
      },
      { messageKey: 'msg' }
    ),
    {
      severityNumber: 9,
      severityText: 'info',
      body: 'test message',
      timestamp: testStart
    }
  )

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 40
      },
      { messageKey: 'msg' }
    ),
    {
      severityNumber: 13,
      severityText: 'warn',
      body: 'test message',
      timestamp: testStart
    }
  )

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 50
      },
      { messageKey: 'msg' }
    ),
    {
      severityNumber: 17,
      severityText: 'error',
      body: 'test message',
      timestamp: testStart
    }
  )

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 60
      },
      {
        messageKey: 'msg',
        severityNumberMap: {
          35: 10
        }
      }
    ),
    {
      severityNumber: 21,
      severityText: 'fatal',
      body: 'test message',
      timestamp: testStart
    }
  )

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 35
      },
      {
        messageKey: 'msg',
        severityNumberMap: {
          35: 10
        },
        customLevelLabels: {
          35: 'custom'
        }
      }
    ),
    {
      severityNumber: 10,
      severityText: 'custom',
      body: 'test message',
      timestamp: testStart
    }
  )

  matchOnlyStrict(
    toOpenTelemetry(
      {
        ...testLogEntryBase,
        level: 42
      },
      {
        messageKey: 'msg',
        severityNumberMap: {
          35: 10
        },
        customLevelLabels: {
          35: 'custom'
        }
      }
    ),
    {
      severityNumber: 0,
      body: 'test message',
      timestamp: testStart
    }
  )
})
