'use strict'

const build = require('pino-abstract-transport')
const { getOtlpLogger } = require('otlp-logger')
const { toOpenTelemetry } = require('./opentelemetry-mapper')
const DEFAULT_MESSAGE_KEY = 'msg'

/**
 * Pino OpenTelemetry transport
 *
 * @typedef {Object} PinoOptions
 * @property {import('pino').LoggerOptions.messageKey} [messageKey="msg"]
 * @property {import('pino').LoggerOptions.customLevels} [customLevels]
 * @property {Object.<number, number>} [severityNumberMap]
 *
 * @typedef {PinoOptions & import('otlp-logger').Options} Options
 *
 * @param { Options } opts
 */
module.exports = async function (opts) {
  const {
    messageKey = DEFAULT_MESSAGE_KEY,
    severityNumberMap,
    customLevels,
    ...loggerOpts
  } = opts

  const customLevelLabels = Object.fromEntries(Object.entries(customLevels ?? {}).map(([label, value]) => [value, label]))

  const logger = getOtlpLogger(loggerOpts)

  const mapperOptions = {
    messageKey,
    customLevelLabels,
    severityNumberMap
  }

  return build(
    async function (/** @type { AsyncIterable<Bindings> } */ source) {
      for await (const obj of source) {
        logger.emit(toOpenTelemetry(obj, mapperOptions))
      }
    },
    {
      async close () {
        return logger.shutdown()
      }
    }
  )
}
