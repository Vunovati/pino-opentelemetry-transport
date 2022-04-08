# pino-opentelemetry-transport
[![npm version](https://img.shields.io/npm/v/pino-opentelemetry-transport)](https://www.npmjs.com/package/pino-opentelemetry-transport)
[![Build Status](https://img.shields.io/github/workflow/status/Vunovati/pino-opentelemetry-transport/CI)](https://github.com/Vunovati/pino-opentelemetry-transport/actions)
[![Known Vulnerabilities](https://snyk.io/test/github/Vunovati/pino-opentelemetry-transport/badge.svg)](https://snyk.io/test/Vunovati/pino-opentelemetry-transport)
<!-- [![Coverage Status](https://coveralls.io/repos/github/Vunovati/pino-opentelemetry-transport/badge.svg?branch=main)](https://coveralls.io/github/Vunovati/pino-opentelemetry-transport?branch=main) -->
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://standardjs.com/)

Pino transport for OpenTelemetry. Outputs logs in the [OpenTelemetry Log Data Model](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/logs/data-model.md).

## Install

```
npm i pino-opentelemetry-transport
```

## Usage

```js
import { join } from 'path'
import pino from 'pino'

const transport = pino.transport({
  target: 'pino-opentelemetry-transport',
  options: { destination: 1 }
})

const logger = pino(transport)
```

(Also works in CommonJS)

## Options

When using the transport the following options can be used:

* `destination`: The destination of the log.
* `messageKey`: The key of the log message to be used as the OpenTelemetry log entry Body. Optional, value `msg` used by default (like in Pino itself).
## License

MIT
