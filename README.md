# pino-opentelemetry-transport

[![npm version](https://img.shields.io/npm/v/pino-opentelemetry-transport)](https://www.npmjs.com/package/pino-opentelemetry-transport)
[![Build Status](https://img.shields.io/github/workflow/status/Vunovati/pino-opentelemetry-transport/CI)](https://github.com/Vunovati/pino-opentelemetry-transport/actions)
[![Known Vulnerabilities](https://snyk.io/test/github/Vunovati/pino-opentelemetry-transport/badge.svg)](https://snyk.io/test/Vunovati/pino-opentelemetry-transport)
<!-- [![Coverage Status](https://coveralls.io/repos/github/Vunovati/pino-opentelemetry-transport/badge.svg?branch=main)](https://coveralls.io/github/Vunovati/pino-opentelemetry-transport?branch=main) -->
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://standardjs.com/)

Pino transport for OpenTelemetry. Outputs logs in the [OpenTelemetry Log Data Model](https://github.com/open-telemetry/opentelemetry-specification/blob/fc8289b8879f3a37e1eba5b4e445c94e74b20359/specification/logs/data-model.md) and sends them to an OTLP logs collector.

## Install

```bash
npm i pino-opentelemetry-transport
```

## Configuration

### Protocol

can be set to `http/protobuf`, `grpc`, `http` or `console` by using

* env var `OTEL_EXPORTER_OTLP_PROTOCOL`
* env var `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL`
* setting the exporterProtocol option

Settings configured programmatically take precedence over environment variables. Per-signal environment variables take precedence over non-per-signal environment variables. This principle applies to all the configurations in this module.

If no protocol is specified, `http/protobuf` is used as a default.

### Exporter settings

#### Collector URL

Set either of the following environment variables:
`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`,
`OTEL_EXPORTER_OTLP_ENDPOINT`

#### Protocol-specific exporter configuration

#### `http/protobuf`

[Env vars in README](https://github.com/open-telemetry/opentelemetry-js/blob/d4a41bd815dd50703f692000a70c59235ad71959/experimental/packages/exporter-trace-otlp-proto/README.md#exporter-timeout-configuration)

#### `grpc`

[Environment Variable Configuration](https://github.com/open-telemetry/opentelemetry-js/blob/d4a41bd815dd50703f692000a70c59235ad71959/experimental/packages/exporter-logs-otlp-grpc/README.md#environment-variable-configuration)

#### `http`

[Env vars in README](https://github.com/open-telemetry/opentelemetry-js/blob/d4a41bd815dd50703f692000a70c59235ad71959/experimental/packages/exporter-trace-otlp-http/README.md#configuration-options-as-environment-variables)

#### Processor-specific configuration

If batch log processor is selected (is default), it can be configured using env vars described in the [OpenTelemetry specification](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#batch-logrecord-processor)

### Options

When using the transport, the following options can be used to configure the transport programmatically:

* `loggerName`: name to be used by the OpenTelemetry logger
* `serviceVersion`: version to be used by the OpenTelemetry logger
* `messageKey`: The key of the log message to be used as the OpenTelemetry log entry Body. Optional, value `msg` used by default (like in Pino itself). Optional
* `severityNumberMap`: Object mapping Pino log level numbers to OpenTelemetry log severity numbers. This is an override for adding custom log levels and changing default log levels. Undefined default Pino log levels will still be mapped to their default OpenTelemetry log severity. Optional
* `customLevels`: If you are using custom log levels in your Pino config, you must pass them here as well for your log records to have defined SeverityText. Optional
* `resourceAttributes`: Object containing [resource attributes](https://opentelemetry.io/docs/instrumentation/js/resources/). Optional
* `logRecordProcessorOptions`: a single object or an array of objects specifying the LogProcessor and LogExporter types and constructor params. Optional

## Usage

### Minimalistic example

Make sure you have access to an OTEL collector.

To start quickly, create a minimal configuration for OTEL collector in the `otel-collector-config.yaml` file:

```yaml
receivers:
  otlp:
    protocols:
      grpc:

exporters:
  file:
    path: ./etc/test-logs/otlp-logs.log
    flush_interval: 1

  logging:
    verbosity: basic
  
processors:
  batch:

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: []
      exporters: [logging, file]
```

The collector can then be ran with:

```bash
docker run --volume=$(pwd)/otel-collector-config.yaml:/etc/otel-collector-config.yaml:rw --volume=/tmp/test-logs:/etc/test-logs:rw -p 4317:4317 -d otel/opentelemetry-collector-contrib:latest --config=/etc/otel-collector-config.yaml
```

Create an index.js file containing

```js
const pino = require('pino')

const transport = pino.transport({
  target: 'pino-opentelemetry-transport'
})

const logger = pino(transport)

transport.on('ready', () => {
  setInterval(() => {
    logger.info('test log')
  }, 1000)
})
```

Install Pino and pino-opentelemetry-transport

```bash
npm install pino pino-opentelemetry-transport
```

Run the service setting the `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` and `OTEL_RESOURCE_ATTRIBUTES` env vars

```bash
OTEL_EXPORTER_OTLP_LOGS_PROTOCOL='grpc' OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4317 OTEL_RESOURCE_ATTRIBUTES="service.name=my-service,service.version=1.2.3" node index.js
```

## Examples

* [Minimalistic](./examples/minimalistic)
* [HTTP Server with trace context propagation](./examples/trace-context)
* [Sending logs to Grafana Loki](./examples/grafana-loki)
* [Using Multiple Record Processors](./examples/using-multiple-record-processors)
* [TypeScript](./examples/typescript)

## Test the repo locally

Run the OTLP collector in a container

```npm run docker-run```

Run an example

```node examples/minimalistic/minimalistic.js```

Observe the logs

```tail -f /tmp/test-logs/otlp-logs.log```

Note that not all log entries will immediately be written to the `otlp-logs.log` file. The collector will flush to the disk eventually. The flush will be forced if the collector receives a kill signal.

## License

MIT
