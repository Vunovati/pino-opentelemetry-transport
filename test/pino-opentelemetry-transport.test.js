'use strict'

const { mkdir, rm, readFile } = require('fs/promises')
const { join } = require('path')
const { test, beforeEach } = require('tap')
const { promisify } = require('util')
const { tmpdir } = require('os')
const requireInject = require('require-inject')

async function cleanAndCreateFolder (path) {
  await rm(path, { force: true, recursive: true })
  await mkdir(path, { force: true, recursive: true })
}

const sleep = promisify(setTimeout)

const logFolder = join(tmpdir(), 'test-logs')

beforeEach(() => cleanAndCreateFolder(logFolder))

const logFile = join(logFolder, 'pino.log')
const MOCK_HOSTNAME = 'hostname'

test('translate Pino log format to Open Telemetry data format for each log level', async ({ same, afterEach }) => {
  const ms = 1531069919686
  const now = Date.now
  Date.now = () => ms

  afterEach(() => {
    Date.now = now

    return rm(logFolder, { force: true, recursive: true })
  })

  const pino = requireInject.withEmptyCache('pino', {
    os: {
      hostname: () => MOCK_HOSTNAME
    }
  })

  const transport = pino.transport({
    level: 'trace',
    target: '..',
    options: { destination: logFile }
  })

  const logger = pino(transport)
  logger.level = 'trace'

  logger.trace('test trace')
  logger.debug('test debug')
  logger.info('test info')
  logger.warn('test warn')
  logger.error('test error')
  logger.fatal('test fatal')

  await sleep(100)
  const content = await readFile(logFile, 'utf8')

  const Timestamp = ms + '0'.repeat(6)

  const Resource = {
    'host.hostname': MOCK_HOSTNAME,
    'process.pid': process.pid
  }

  const Attributes = {}

  const expectedLines = [
    { Body: 'test trace', Timestamp, SeverityNumber: 1, SeverityText: 'TRACE', Resource, Attributes },
    { Body: 'test debug', Timestamp, SeverityNumber: 5, SeverityText: 'DEBUG', Resource, Attributes },
    { Body: 'test info', Timestamp, SeverityNumber: 9, SeverityText: 'INFO', Resource, Attributes },
    { Body: 'test warn', Timestamp, SeverityNumber: 13, SeverityText: 'WARN', Resource, Attributes },
    { Body: 'test error', Timestamp, SeverityNumber: 17, SeverityText: 'ERROR', Resource, Attributes },
    { Body: 'test fatal', Timestamp, SeverityNumber: 21, SeverityText: 'FATAL', Resource, Attributes }
  ]

  const logEntries = content.split('\n').filter(Boolean).map(JSON.parse)

  for (const [lineNumber, logLine] of logEntries.entries()) {
    same(logLine, expectedLines[lineNumber], `line ${lineNumber} severity is mapped correctly`)
  }
})

test('translate Pino log format to Open Telemetry data and store all extra bindings as attributes', async ({ afterEach, equal, same }) => {
  const ms = 1531069919686
  const now = Date.now
  Date.now = () => ms

  afterEach(() => {
    Date.now = now

    return rm(logFolder, { force: true, recursive: true })
  })

  const pino = requireInject.withEmptyCache('pino', {
    os: {
      hostname: () => MOCK_HOSTNAME
    }
  })

  const transport = pino.transport({
    level: 'trace',
    target: '..',
    options: { destination: logFile }
  })

  const logger = pino(transport)
  logger.level = 'trace'

  const extra = {
    foo: 'bar',
    baz: 'qux'
  }

  logger.trace(extra, 'test trace')

  await sleep(100)
  const content = await readFile(logFile, 'utf8')

  const Timestamp = ms + '0'.repeat(6)

  const Resource = {
    'host.hostname': MOCK_HOSTNAME,
    'process.pid': process.pid
  }

  const Attributes = extra

  const expectedLine = { Body: 'test trace', Timestamp, SeverityNumber: 1, SeverityText: 'TRACE', Resource, Attributes }

  const logEntries = content.split('\n').filter(Boolean).map(JSON.parse)

  equal(logEntries.length, 1, 'only one log entry is written')
  same(logEntries[0], expectedLine, 'log entry contains all extra bindings as attributes')
})

test('translate Pino log format to Open Telemetry data with custom messageKey', async ({ afterEach, equal, same }) => {
  const ms = 1531069919686
  const now = Date.now
  Date.now = () => ms

  afterEach(() => {
    Date.now = now

    return rm(logFolder, { force: true, recursive: true })
  })

  const pino = requireInject.withEmptyCache('pino', {
    os: {
      hostname: () => MOCK_HOSTNAME
    }
  })

  const MESSAGE_KEY = 'customMessageKey'

  const transport = pino.transport({
    level: 'trace',
    target: '..',
    options: { destination: logFile, messageKey: MESSAGE_KEY }
  })

  const logger = pino(transport)
  logger.level = 'trace'

  const extra = {
    foo: 'bar',
    baz: 'qux',
    [MESSAGE_KEY]: 'test message for message key'
  }

  logger.trace(extra, 'test trace')

  await sleep(100)
  const content = await readFile(logFile, 'utf8')

  const Timestamp = ms + '0'.repeat(6)

  const Resource = {
    'host.hostname': MOCK_HOSTNAME,
    'process.pid': process.pid
  }

  const Attributes = {
    foo: 'bar',
    baz: 'qux',
    msg: 'test trace'
  }

  const expectedLine = { Body: 'test message for message key', Timestamp, SeverityNumber: 1, SeverityText: 'TRACE', Resource, Attributes }

  const logEntries = content.split('\n').filter(Boolean).map(JSON.parse)

  equal(logEntries.length, 1, 'only one log entry is written')
  same(logEntries[0], expectedLine, 'the log line interprets the custom messageKey value as Body')
})

test('handle backpressure', async ({ afterEach, equal }) => {
  afterEach(() => {
    return rm(logFolder, { force: true, recursive: true })
  })

  const pino = require('pino')

  const transport = pino.transport({
    level: 'trace',
    target: '..',
    options: { destination: logFile }
  })

  const logger = pino(transport)
  logger.level = 'trace'

  const N_LOG_LINES = 10_000
  for (let i = 0; i < N_LOG_LINES; i++) {
    logger.trace('test trace')
  }

  await sleep(1000)

  const content = await readFile(logFile, 'utf8')

  const logEntries = content.split('\n').filter(Boolean).map(JSON.parse)

  equal(logEntries.length, N_LOG_LINES, 'all log lines are written')
})
