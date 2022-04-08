import { expectType } from "tsd";
import { OnUnknown } from "pino-abstract-transport";
import { Transform } from "stream";

import transport from "../../pino-opentelemetry-transport";

expectType<Promise<Transform & OnUnknown>>(transport({ destination: 'filename'}));
expectType<Promise<Transform & OnUnknown>>(transport({ destination: 1}));
expectType<Promise<Transform & OnUnknown>>(transport({ destination: 'filename', messageKey: 'message' }));
expectType<Promise<Transform & OnUnknown>>(transport({ destination: 1, messageKey: 'message' }));
