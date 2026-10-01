#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@typesafe-ai/sdk/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  APIConnectionError: () => APIConnectionError,
  APIError: () => APIError,
  APIPromise: () => APIPromise,
  APITimeoutError: () => APITimeoutError,
  APIUserAbortError: () => APIUserAbortError,
  AuthenticationError: () => AuthenticationError,
  BadRequestError: () => BadRequestError,
  ENV: () => ENV,
  InternalServerError: () => InternalServerError,
  LOG_LEVELS: () => LOG_LEVELS,
  NotFoundError: () => NotFoundError,
  PermissionDeniedError: () => PermissionDeniedError,
  RateLimitError: () => RateLimitError,
  TypeSafeClient: () => TypeSafeClient,
  TypeSafeError: () => TypeSafeError,
  UnprocessableEntityError: () => UnprocessableEntityError,
  VERSION: () => VERSION2,
  choice: () => choice,
  noul: () => noul,
  score: () => score
});
var requestIdFrom, APIPromise, ENV, readEnv, fromCodeOrEnv, range, DEFAULT_RETRY_POLICY, isRetryableStatus, parseRetryAfter, retryDelayMs, sleep, TypeSafeError, isRecord, extractMessage, describeValidationErrors, MAX_RAW_BODY_IN_MESSAGE, APIError, BadRequestError, AuthenticationError, PermissionDeniedError, NotFoundError, UnprocessableEntityError, RateLimitError, InternalServerError, APIConnectionError, APITimeoutError, APIUserAbortError, LOG_LEVELS, DEFAULT_LOG_LEVEL, isLogLevel, parseLogLevel, PREFIX, consoleLogger, RANK, drop, withLevel, KEY_HEADERS, OPAQUE_HEADERS, redactKey, redact, redactHeaders, noul, score, choice, validateQuestions, Models, unwrapModels, g, isBrowser, describeRuntime, VERSION2, missingApiKey, missingFetch, refuseBrowser, defaultFetch, assertNonNegativeInteger, assertPositiveMs, assertNonNegativeMs, assertFraction, assertStatusSet, resolveRetryPolicy, isRetryableError, resolveLogLevel, stripTrailingSlashes, mergeHeaders, bufferResponse, RUNTIME, TypeSafeClient, parseBody;
var init_dist = __esm({
  "node_modules/@typesafe-ai/sdk/dist/index.mjs"() {
    requestIdFrom = /* @__PURE__ */ __name((headers) => headers.get("x-typesafe-request-id") ?? void 0, "requestIdFrom");
    APIPromise = class APIPromise2 extends Promise {
      static {
        __name(this, "APIPromise");
      }
      #responsePromise;
      #parseResponse;
      #parsed;
      constructor(responsePromise, parseResponse) {
        super((resolve7) => resolve7(void 0));
        this.#responsePromise = responsePromise;
        this.#parseResponse = parseResponse;
      }
      /**
      * Resolves to the raw `Response` without parsing the body. SDK requests buffer the full
      * body under the request timeout before handoff; reading it afterwards is caller-owned.
      * The caller owns the body; don't also `await` the parsed result on the same promise.
      */
      asResponse() {
        return this.#responsePromise;
      }
      /** Return the parsed result, HTTP response, and request ID. */
      async withResponse() {
        const [data, response] = await Promise.all([this.#parse(), this.#responsePromise]);
        return {
          data,
          response,
          requestId: requestIdFrom(response.headers)
        };
      }
      /** Transform the parsed result, sharing the HTTP response and a single body parse. */
      map(fn) {
        return new APIPromise2(this.#responsePromise, () => this.#parse().then(fn));
      }
      #parse() {
        this.#parsed ??= this.#responsePromise.then(this.#parseResponse);
        return this.#parsed;
      }
      then(onfulfilled, onrejected) {
        return this.#parse().then(onfulfilled, onrejected);
      }
      catch(onrejected) {
        return this.#parse().catch(onrejected);
      }
      finally(onfinally) {
        return this.#parse().finally(onfinally);
      }
    };
    ENV = {
      /** Required API key; used when `apiKey` is omitted. */
      apiKey: "TYPESAFE_API_KEY",
      /** API root; defaults to `https://api.typesafe.ai`. */
      baseURL: "TYPESAFE_BASE_URL",
      /** Default model name; defaults to `jev-latest`. */
      defaultModel: "TYPESAFE_DEFAULT_MODEL",
      /** Log level; defaults to `warn`. */
      logLevel: "TYPESAFE_LOG_LEVEL"
    };
    readEnv = /* @__PURE__ */ __name((name) => {
      if (typeof process === "undefined" || !process.env) return void 0;
      return process.env[name]?.trim() || void 0;
    }, "readEnv");
    fromCodeOrEnv = /* @__PURE__ */ __name((fromCode, envVar) => fromCode ?? readEnv(envVar), "fromCodeOrEnv");
    range = /* @__PURE__ */ __name((from, to) => Array.from({ length: to - from }, (_, i) => from + i), "range");
    DEFAULT_RETRY_POLICY = {
      maxRetries: 2,
      backoffInitialMs: 500,
      backoffMaxMs: 5e3,
      backoffJitter: 0.25,
      /** HTTP 408, 429, and 5xx responses. */
      httpStatuses: /* @__PURE__ */ new Set([
        408,
        429,
        ...range(500, 600)
      ]),
      respectRetryAfter: true,
      /** Maximum server retry delay before falling back to backoff. */
      maxRetryAfterMs: 6e4,
      apiConnectionError: true,
      apiTimeoutError: true
    };
    DEFAULT_RETRY_POLICY.maxRetries;
    isRetryableStatus = /* @__PURE__ */ __name((status, policy = DEFAULT_RETRY_POLICY) => policy.httpStatuses.has(status), "isRetryableStatus");
    parseRetryAfter = /* @__PURE__ */ __name((headers, now = Date.now()) => {
      const ms = Number(headers.get("retry-after-ms"));
      if (headers.has("retry-after-ms") && Number.isFinite(ms) && ms >= 0) return ms;
      const raw = headers.get("retry-after");
      if (raw === null) return void 0;
      const seconds = Number(raw);
      if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1e3 : void 0;
      const date = Date.parse(raw);
      if (!Number.isNaN(date)) return Math.max(0, date - now);
    }, "parseRetryAfter");
    retryDelayMs = /* @__PURE__ */ __name((attempt, headers, policy = DEFAULT_RETRY_POLICY, random = Math.random) => {
      if (policy.respectRetryAfter && headers !== void 0) {
        const retryAfter = parseRetryAfter(headers);
        if (retryAfter !== void 0 && retryAfter <= policy.maxRetryAfterMs) return retryAfter;
      }
      const exponential = Math.min(policy.backoffInitialMs * 2 ** attempt, policy.backoffMaxMs);
      return Math.round(exponential * (1 - random() * policy.backoffJitter));
    }, "retryDelayMs");
    sleep = /* @__PURE__ */ __name((ms, signal) => new Promise((resolve7, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const onAbort = /* @__PURE__ */ __name(() => {
        clearTimeout(timer);
        reject(signal?.reason);
      }, "onAbort");
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve7();
      }, ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    }), "sleep");
    TypeSafeError = class extends Error {
      static {
        __name(this, "TypeSafeError");
      }
      constructor(message, options) {
        super(message, options);
        this.name = new.target.name;
      }
    };
    isRecord = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null, "isRecord");
    extractMessage = /* @__PURE__ */ __name((body) => {
      if (typeof body === "string") return body || void 0;
      if (!isRecord(body)) return void 0;
      const { error, message, detail } = body;
      if (typeof error === "string") return error;
      if (isRecord(error) && typeof error.message === "string") return error.message;
      if (typeof message === "string") return message;
      if (typeof detail === "string") return detail;
      if (isRecord(detail) && typeof detail.message === "string") return detail.message;
      if (Array.isArray(detail)) return describeValidationErrors(detail);
    }, "extractMessage");
    describeValidationErrors = /* @__PURE__ */ __name((errors) => {
      const parts = errors.flatMap((e) => {
        if (!isRecord(e) || typeof e.msg !== "string") return [];
        const loc = Array.isArray(e.loc) ? e.loc.filter((x) => x !== "body").join(".") : "";
        return [loc ? `${loc}: ${e.msg}` : e.msg];
      });
      return parts.length > 0 ? parts.join("; ") : void 0;
    }, "describeValidationErrors");
    MAX_RAW_BODY_IN_MESSAGE = 200;
    APIError = class APIError2 extends TypeSafeError {
      static {
        __name(this, "APIError");
      }
      /** HTTP response status code. */
      status;
      /** HTTP response headers. */
      headers;
      /** Parsed JSON, response text, or `undefined` for an empty body. */
      body;
      /** Request ID from `x-typesafe-request-id`, or `undefined` when absent. */
      requestId;
      constructor(status, body, headers, message) {
        super(message ?? APIError2.describe(status, body));
        this.status = status;
        this.body = body;
        this.headers = headers;
        this.requestId = requestIdFrom(headers);
      }
      static describe(status, body) {
        const detail = extractMessage(body);
        if (detail) return `${status} ${detail}`;
        if (body === void 0) return `${status} status code (no body)`;
        const raw = typeof body === "string" ? body : JSON.stringify(body);
        return `${status} ${raw.length > MAX_RAW_BODY_IN_MESSAGE ? `${raw.slice(0, MAX_RAW_BODY_IN_MESSAGE)}…` : raw}`;
      }
      /** Create the error subclass for an HTTP status code. */
      static fromResponse(status, body, headers) {
        if (status === 400) return new BadRequestError(status, body, headers);
        if (status === 401) return new AuthenticationError(status, body, headers);
        if (status === 403) return new PermissionDeniedError(status, body, headers);
        if (status === 404) return new NotFoundError(status, body, headers);
        if (status === 422) return new UnprocessableEntityError(status, body, headers);
        if (status === 429) return new RateLimitError(status, body, headers);
        if (status >= 500) return new InternalServerError(status, body, headers);
        return new APIError2(status, body, headers);
      }
    };
    BadRequestError = class extends APIError {
      static {
        __name(this, "BadRequestError");
      }
    };
    AuthenticationError = class extends APIError {
      static {
        __name(this, "AuthenticationError");
      }
    };
    PermissionDeniedError = class extends APIError {
      static {
        __name(this, "PermissionDeniedError");
      }
    };
    NotFoundError = class extends APIError {
      static {
        __name(this, "NotFoundError");
      }
    };
    UnprocessableEntityError = class extends APIError {
      static {
        __name(this, "UnprocessableEntityError");
      }
    };
    RateLimitError = class extends APIError {
      static {
        __name(this, "RateLimitError");
      }
      /** Server retry delay in milliseconds, or `undefined` when absent or invalid. */
      retryAfterMs = parseRetryAfter(this.headers);
    };
    InternalServerError = class extends APIError {
      static {
        __name(this, "InternalServerError");
      }
    };
    APIConnectionError = class extends TypeSafeError {
      static {
        __name(this, "APIConnectionError");
      }
      constructor(message = "Connection error.", options) {
        super(message, options);
      }
    };
    APITimeoutError = class extends APIConnectionError {
      static {
        __name(this, "APITimeoutError");
      }
      /** Configured timeout in milliseconds. */
      timeoutMs;
      constructor(timeoutMs, options) {
        super(`Request timed out after ${timeoutMs}ms.`, options);
        this.timeoutMs = timeoutMs;
      }
    };
    APIUserAbortError = class extends TypeSafeError {
      static {
        __name(this, "APIUserAbortError");
      }
      constructor(message = "Request was aborted.", options) {
        super(message, options);
      }
    };
    LOG_LEVELS = [
      "debug",
      "info",
      "warn",
      "error",
      "off"
    ];
    DEFAULT_LOG_LEVEL = "warn";
    isLogLevel = /* @__PURE__ */ __name((value) => LOG_LEVELS.includes(value), "isLogLevel");
    parseLogLevel = /* @__PURE__ */ __name((value, source) => {
      if (isLogLevel(value)) return value;
      throw new TypeSafeError(`Invalid log level "${value}" from ${source}. Expected one of: ${LOG_LEVELS.join(", ")}.`);
    }, "parseLogLevel");
    PREFIX = "[typesafe-sdk]";
    consoleLogger = {
      debug: /* @__PURE__ */ __name((message, ...args) => console.debug(`${PREFIX} ${message}`, ...args), "debug"),
      info: /* @__PURE__ */ __name((message, ...args) => console.info(`${PREFIX} ${message}`, ...args), "info"),
      warn: /* @__PURE__ */ __name((message, ...args) => console.warn(`${PREFIX} ${message}`, ...args), "warn"),
      error: /* @__PURE__ */ __name((message, ...args) => console.error(`${PREFIX} ${message}`, ...args), "error")
    };
    RANK = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      off: 4
    };
    drop = /* @__PURE__ */ __name(() => {
    }, "drop");
    withLevel = /* @__PURE__ */ __name((sink, level) => {
      const enabled = /* @__PURE__ */ __name((at) => RANK[at] >= RANK[level], "enabled");
      return {
        debug: enabled("debug") ? (message, ...args) => sink.debug(message, ...args) : drop,
        info: enabled("info") ? (message, ...args) => sink.info(message, ...args) : drop,
        warn: enabled("warn") ? (message, ...args) => sink.warn(message, ...args) : drop,
        error: enabled("error") ? (message, ...args) => sink.error(message, ...args) : drop
      };
    }, "withLevel");
    KEY_HEADERS = /* @__PURE__ */ new Set([
      "authorization",
      "proxy-authorization",
      "x-api-key"
    ]);
    OPAQUE_HEADERS = /* @__PURE__ */ new Set(["cookie", "set-cookie"]);
    redactKey = /* @__PURE__ */ __name((value) => {
      const [scheme, secret] = value.includes(" ") ? value.split(/\s+/, 2) : [void 0, value];
      const tail = secret && secret.length > 8 ? secret.slice(-4) : "";
      return `${scheme ? `${scheme} ` : ""}***${tail}`;
    }, "redactKey");
    redact = /* @__PURE__ */ __name((name, value) => {
      const lower = name.toLowerCase();
      if (KEY_HEADERS.has(lower)) return redactKey(value);
      if (OPAQUE_HEADERS.has(lower)) return "***";
      return value;
    }, "redact");
    redactHeaders = /* @__PURE__ */ __name((headers) => Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, redact(name, value)])), "redactHeaders");
    noul = /* @__PURE__ */ __name((instructions = null, criteria) => ({
      type: "noul",
      instructions,
      criteria
    }), "noul");
    score = /* @__PURE__ */ __name((instructions, criteria) => {
      if (!Array.isArray(criteria)) throw new TypeSafeError("Score criteria must be a list of descriptions indexed by score from zero, not a map.");
      return {
        type: "score",
        instructions,
        criteria
      };
    }, "score");
    choice = /* @__PURE__ */ __name((instructions, criteria) => {
      if (Array.isArray(criteria)) throw new TypeSafeError("Choice criteria must be a map of labels to descriptions, not a list.");
      return {
        type: "choice",
        instructions,
        criteria
      };
    }, "choice");
    validateQuestions = /* @__PURE__ */ __name((questions) => {
      if (Object.keys(questions).length === 0) throw new TypeSafeError("At least one question is required.");
      for (const [name, question3] of Object.entries(questions)) {
        if (question3.type !== "score") continue;
        if (!Array.isArray(question3.criteria)) throw new TypeSafeError(`Score question "${name}" has criteria that are not a list; score criteria must be a list of descriptions indexed by score from zero.`);
        if (question3.criteria.length < 2) throw new TypeSafeError(`Score question "${name}" has ${question3.criteria.length} criteria; at least two scores are required.`);
      }
    }, "validateQuestions");
    Models = class {
      static {
        __name(this, "Models");
      }
      #transport;
      constructor(transport) {
        this.#transport = transport;
      }
      /** List the models available to the account. */
      list(options = {}) {
        return this.#transport.request("GET", "/v1/models", options).map(unwrapModels);
      }
    };
    unwrapModels = /* @__PURE__ */ __name((wire) => {
      if (Array.isArray(wire?.models)) return wire.models;
      throw new TypeSafeError("Unexpected response shape from GET /v1/models; expected { models: [...] }.");
    }, "unwrapModels");
    g = globalThis;
    isBrowser = /* @__PURE__ */ __name(() => typeof g.window !== "undefined" && typeof g.window.document !== "undefined" && typeof g.navigator !== "undefined", "isBrowser");
    describeRuntime = /* @__PURE__ */ __name(() => {
      const platform = g.process?.platform && g.process?.arch ? ` (${g.process.platform}; ${g.process.arch})` : "";
      if (g.Bun?.version) return `bun/${g.Bun.version}${platform}`;
      if (g.Deno?.version?.deno) return `deno/${g.Deno.version.deno}${platform}`;
      if (g.EdgeRuntime !== void 0) return "vercel-edge";
      if (g.navigator?.userAgent === "Cloudflare-Workers") return "cloudflare-workers";
      if (g.process?.versions?.node) return `node/${g.process.versions.node}${platform}`;
      if (isBrowser()) return "browser";
      return "unknown";
    }, "describeRuntime");
    VERSION2 = "0.6.0";
    missingApiKey = /* @__PURE__ */ __name(() => {
      throw new TypeSafeError(`No API key was provided. Pass \`apiKey\` to the TypeSafeClient constructor or set the ${ENV.apiKey} environment variable.`);
    }, "missingApiKey");
    missingFetch = /* @__PURE__ */ __name(() => {
      throw new TypeSafeError("No global `fetch` is available in this runtime. Pass a `fetch` implementation to the TypeSafeClient constructor.");
    }, "missingFetch");
    refuseBrowser = /* @__PURE__ */ __name(() => {
      throw new TypeSafeError("TypeSafeClient is running in a browser, which would expose your API key to anyone using the page. Call the API from a server instead, or pass `dangerouslyAllowBrowser: true` if you understand the risk.");
    }, "refuseBrowser");
    defaultFetch = /* @__PURE__ */ __name((input, init) => globalThis.fetch(input, init), "defaultFetch");
    assertNonNegativeInteger = /* @__PURE__ */ __name((name, value) => {
      if (!Number.isInteger(value) || value < 0) throw new TypeSafeError(`\`${name}\` must be a non-negative integer, got ${String(value)}.`);
      return value;
    }, "assertNonNegativeInteger");
    assertPositiveMs = /* @__PURE__ */ __name((name, value) => {
      if (!Number.isFinite(value) || value <= 0) throw new TypeSafeError(`\`${name}\` must be a positive number of milliseconds, got ${String(value)}.`);
      return value;
    }, "assertPositiveMs");
    assertNonNegativeMs = /* @__PURE__ */ __name((name, value) => {
      if (!Number.isFinite(value) || value < 0) throw new TypeSafeError(`\`${name}\` must be a non-negative number of milliseconds, got ${String(value)}.`);
      return value;
    }, "assertNonNegativeMs");
    assertFraction = /* @__PURE__ */ __name((name, value) => {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new TypeSafeError(`\`${name}\` must be between 0 and 1, got ${String(value)}.`);
      return value;
    }, "assertFraction");
    assertStatusSet = /* @__PURE__ */ __name((name, statuses) => {
      for (const status of statuses) if (!Number.isInteger(status) || status < 100 || status > 999) throw new TypeSafeError(`\`${name}\` must contain HTTP status codes, got ${String(status)}.`);
      return statuses;
    }, "assertStatusSet");
    resolveRetryPolicy = /* @__PURE__ */ __name((base2, overrides) => {
      const o = overrides ?? {};
      return {
        maxRetries: o.maxRetries === void 0 ? base2.maxRetries : assertNonNegativeInteger("retry.maxRetries", o.maxRetries),
        backoffInitialMs: o.backoffInitialMs === void 0 ? base2.backoffInitialMs : assertNonNegativeMs("retry.backoffInitialMs", o.backoffInitialMs),
        backoffMaxMs: o.backoffMaxMs === void 0 ? base2.backoffMaxMs : assertNonNegativeMs("retry.backoffMaxMs", o.backoffMaxMs),
        backoffJitter: o.backoffJitter === void 0 ? base2.backoffJitter : assertFraction("retry.backoffJitter", o.backoffJitter),
        httpStatuses: new Set(o.httpStatuses === void 0 ? base2.httpStatuses : assertStatusSet("retry.httpStatuses", o.httpStatuses)),
        respectRetryAfter: o.respectRetryAfter ?? base2.respectRetryAfter,
        maxRetryAfterMs: o.maxRetryAfterMs === void 0 ? base2.maxRetryAfterMs : assertNonNegativeMs("retry.maxRetryAfterMs", o.maxRetryAfterMs),
        apiConnectionError: o.apiConnectionError ?? base2.apiConnectionError,
        apiTimeoutError: o.apiTimeoutError ?? base2.apiTimeoutError
      };
    }, "resolveRetryPolicy");
    isRetryableError = /* @__PURE__ */ __name((err, policy) => {
      if (err instanceof APITimeoutError) return policy.apiTimeoutError;
      if (err instanceof APIConnectionError) return policy.apiConnectionError;
      return false;
    }, "isRetryableError");
    resolveLogLevel = /* @__PURE__ */ __name((fromCode) => {
      if (fromCode !== void 0) return parseLogLevel(fromCode, "the `logLevel` option");
      const fromEnv = readEnv(ENV.logLevel);
      if (fromEnv !== void 0) return parseLogLevel(fromEnv, ENV.logLevel);
      return DEFAULT_LOG_LEVEL;
    }, "resolveLogLevel");
    stripTrailingSlashes = /* @__PURE__ */ __name((url) => url.replace(/\/+$/, ""), "stripTrailingSlashes");
    mergeHeaders = /* @__PURE__ */ __name((...sources) => {
      const entries = /* @__PURE__ */ new Map();
      for (const source of sources) for (const [name, value] of Object.entries(source)) if (value === void 0) entries.delete(name.toLowerCase());
      else entries.set(name.toLowerCase(), [name, value]);
      return Object.fromEntries(entries.values());
    }, "mergeHeaders");
    bufferResponse = /* @__PURE__ */ __name(async (response, signal) => {
      const reader = response.clone().body?.getReader();
      if (!reader) return;
      const cancel = /* @__PURE__ */ __name(() => {
        reader.cancel(signal.reason).catch(() => {
        });
        response.body?.cancel(signal.reason).catch(() => {
        });
      }, "cancel");
      signal.addEventListener("abort", cancel, { once: true });
      try {
        if (signal.aborted) cancel();
        signal.throwIfAborted();
        while (!(await reader.read()).done) signal.throwIfAborted();
        signal.throwIfAborted();
      } finally {
        signal.removeEventListener("abort", cancel);
        reader.releaseLock();
      }
    }, "bufferResponse");
    RUNTIME = describeRuntime();
    TypeSafeClient = class {
      static {
        __name(this, "TypeSafeClient");
      }
      /** API key excluded from serialization and public properties. */
      #apiKey;
      /** API root with trailing slashes removed. */
      baseURL;
      /** Model used when a request omits `model`. */
      defaultModel;
      /** Configured log verbosity. */
      logLevel;
      /** The configured logger, filtered to `logLevel`. */
      logger;
      /** Retry settings with constructor overrides applied. */
      retry;
      /** Timeout per attempt in milliseconds. */
      timeout;
      /** Additional headers sent with each request. */
      defaultHeaders;
      /** HTTP fetch implementation. */
      fetch;
      /** The models available to the account. */
      models;
      #requestCount = 0;
      /**
      * Create a client for the TypeSafe AI API.
      *
      * Explicit options take precedence over environment variables, then SDK defaults.
      * Empty or whitespace-only environment values are ignored.
      *
      * @throws {TypeSafeError} The API key is missing, configuration is invalid, or the runtime is unsupported.
      */
      constructor(config = {}) {
        if (isBrowser() && !config.dangerouslyAllowBrowser) refuseBrowser();
        this.#apiKey = fromCodeOrEnv(config.apiKey, ENV.apiKey) ?? missingApiKey();
        this.baseURL = stripTrailingSlashes(fromCodeOrEnv(config.baseURL, ENV.baseURL) ?? "https://api.typesafe.ai");
        this.defaultModel = fromCodeOrEnv(config.defaultModel, ENV.defaultModel) ?? "jev-latest";
        this.logLevel = resolveLogLevel(config.logLevel);
        this.logger = withLevel(config.logger ?? consoleLogger, this.logLevel);
        this.retry = resolveRetryPolicy(DEFAULT_RETRY_POLICY, config.retry);
        this.timeout = assertPositiveMs("timeout", config.timeout ?? 1e4);
        this.defaultHeaders = { ...config.defaultHeaders };
        if (config.fetch === void 0 && typeof globalThis.fetch !== "function") missingFetch();
        this.fetch = config.fetch ?? defaultFetch;
        const transport = {
          request: /* @__PURE__ */ __name((method, path, options) => this.#request(method, path, options), "request"),
          defaultModel: this.defaultModel
        };
        this.models = new Models(transport);
      }
      /**
      * Answer named questions about text or structured state.
      *
      * @param request - State, questions, and an optional model override.
      * @param options - Per-call timeout, retry, headers, and cancellation settings.
      * @returns Answers typed by question name and criteria, with model and token usage.
      * @throws {TypeSafeError} Questions are empty, or score criteria are not a list of at least two entries.
      * @throws {APIError} The server returns a non-2xx response after retries.
      * @throws {APIConnectionError} The request cannot connect or times out after retries.
      * @throws {APIUserAbortError} The caller aborts the request.
      *
      * @example
      * ```ts
      * const { answers } = await client.systemOne({
      *   state: "I was charged twice. Please help.",
      *   questions: { billing: noul("Is this about billing?") },
      * });
      * console.log(answers.billing.noul);
      * ```
      */
      systemOne(request2, options = {}) {
        validateQuestions(request2.questions);
        const body = {
          ...request2,
          model: request2.model ?? this.defaultModel
        };
        return this.#request("POST", "/v1/systemone", {
          ...options,
          body
        });
      }
      /** Send a request and parse its response body. */
      #request(method, path, options = {}) {
        const resolved = {
          method,
          path,
          body: options.body,
          headers: mergeHeaders(this.defaultHeaders, options.headers ?? {}),
          signal: options.signal,
          timeout: options.timeout === void 0 ? this.timeout : assertPositiveMs("timeout", options.timeout),
          retry: resolveRetryPolicy(this.retry, options.retry)
        };
        const tag = `#${++this.#requestCount} ${method} ${path}`;
        return new APIPromise(this.fetchWithRetries(tag, resolved), async (res) => {
          const parsed = await parseBody(res);
          this.logger.debug(`${tag} <- body`, parsed);
          return parsed;
        });
      }
      /** Retry eligible failures, logging attempt summaries at `info` and headers and bodies at `debug`. */
      async fetchWithRetries(tag, req) {
        const url = `${this.baseURL}${req.path}`;
        const headers = mergeHeaders(req.headers, {
          Authorization: `Bearer ${this.#apiKey}`,
          Accept: "application/json",
          "User-Agent": `typesafe-sdk/${VERSION2}`,
          "X-TypeSafe-SDK": `typesafe-sdk/${VERSION2}`,
          "X-TypeSafe-Runtime": RUNTIME,
          "Content-Type": req.body === void 0 ? void 0 : "application/json",
          "X-TypeSafe-Retry-Count": void 0
        });
        const body = req.body === void 0 ? void 0 : JSON.stringify(req.body);
        for (let attempt = 0; ; attempt++) {
          const retriesLeft = req.retry.maxRetries - attempt;
          const attemptHeaders = attempt === 0 ? headers : {
            ...headers,
            "X-TypeSafe-Retry-Count": String(attempt)
          };
          this.logger.debug(`${tag} -> ${url}`, {
            headers: redactHeaders(attemptHeaders),
            body: req.body
          });
          const started = Date.now();
          let res;
          try {
            res = await this.attempt(tag, url, {
              method: req.method,
              headers: attemptHeaders,
              body
            }, req);
          } catch (err) {
            if (err instanceof APIUserAbortError || retriesLeft <= 0) throw err;
            if (!isRetryableError(err, req.retry)) throw err;
            await this.backOff(tag, attempt, retriesLeft, err.message, void 0, req);
            continue;
          }
          const requestId = requestIdFrom(res.headers);
          this.logger.info(`${tag} <- ${res.status} in ${Date.now() - started}ms${requestId ? ` (request ${requestId})` : ""}`);
          if (res.ok) return res;
          const errorBody = await parseBody(res);
          this.logger.debug(`${tag} <- error body`, errorBody);
          const error = APIError.fromResponse(res.status, errorBody, res.headers);
          if (retriesLeft <= 0 || !isRetryableStatus(res.status, req.retry)) throw error;
          await this.backOff(tag, attempt, retriesLeft, `${res.status}`, res.headers, req);
        }
      }
      /**
      * One HTTP round trip, including body delivery, with a timeout. The caller's signal and our
      * timer both abort the same controller; we check which fired to choose the error class.
      */
      async attempt(tag, url, init, { signal, timeout }) {
        const controller = new AbortController();
        const abortFromCaller = /* @__PURE__ */ __name(() => controller.abort(signal?.reason), "abortFromCaller");
        if (signal?.aborted) abortFromCaller();
        signal?.addEventListener("abort", abortFromCaller, { once: true });
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeout);
        const started = Date.now();
        const elapsed = /* @__PURE__ */ __name(() => `${Date.now() - started}ms`, "elapsed");
        try {
          const response = await this.fetch(url, {
            ...init,
            signal: controller.signal
          });
          await bufferResponse(response, controller.signal);
          return response;
        } catch (err) {
          if (signal?.aborted) {
            this.logger.info(`${tag} aborted by caller after ${elapsed()}`);
            throw new APIUserAbortError(void 0, { cause: err });
          }
          if (timedOut) {
            this.logger.info(`${tag} timed out after ${elapsed()}`);
            throw new APITimeoutError(timeout, { cause: err });
          }
          this.logger.info(`${tag} connection error after ${elapsed()}`, err);
          throw new APIConnectionError(err instanceof Error ? `Connection error: ${err.message}` : void 0, { cause: err });
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abortFromCaller);
        }
      }
      /** Wait before retrying; caller cancellation throws `APIUserAbortError`. */
      async backOff(tag, attempt, retriesLeft, reason, headers, { retry, signal }) {
        const delay = retryDelayMs(attempt, headers, retry);
        const nth = attempt + 1;
        const total = attempt + retriesLeft;
        this.logger.info(`${tag} retrying in ${delay}ms (retry ${nth}/${total}) after ${reason}`);
        try {
          await sleep(delay, signal);
        } catch (err) {
          this.logger.info(`${tag} aborted by caller while waiting to retry`);
          throw new APIUserAbortError(void 0, { cause: err });
        }
      }
    };
    parseBody = /* @__PURE__ */ __name(async (res) => {
      const text = await res.text();
      if (text.length === 0) return void 0;
      if ((res.headers.get("content-type") ?? "").includes("application/json")) try {
        return JSON.parse(text);
      } catch {
        return text;
      }
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }, "parseBody");
  }
});

// src/engine/abort-guard.ts
function isSdkAbort(reason) {
  return typeof reason === "object" && reason !== null && reason instanceof DOMException && (reason.name === "AbortError" || reason.name === "TimeoutError");
}
__name(isSdkAbort, "isSdkAbort");
function installAbortGuard() {
  process.on("unhandledRejection", (reason) => {
    if (isSdkAbort(reason)) return;
    throw reason;
  });
}
__name(installAbortGuard, "installAbortGuard");

// src/cli/commands/decide.ts
import { readFileSync as readFileSync7, statSync as statSync3 } from "node:fs";
import { resolve as resolve3 } from "node:path";

// src/engine/compare.ts
var EPSILON = 1e-9;
var atLeast = /* @__PURE__ */ __name((value, bound) => value - bound >= -EPSILON, "atLeast");
var atMost = /* @__PURE__ */ __name((value, bound) => bound - value >= -EPSILON, "atMost");

// src/engine/config.ts
var KIT = "claude-referee";
var VERSION = "0.1.6";
var DEFAULT_MODEL = "jev-1.13.0";
var MARKETPLACE = "claude-referee";
var DEFAULT_BASE_URL = "https://api.typesafe.ai";
var USD_PER_MTOK = {
  "jev-1.13.0": 0.042
};
var DETAIL_LIMIT = 1500;
var ERROR_LIMIT = 2e3;
var STATE_TOKEN_LIMIT = 32e3;
var REQUEST_TOKEN_LIMIT = 64e3;
var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var BATCH_DEADLINE_MS = 9e4;
var PROFILES = {
  cli: { budgetMs: 3e4, perAttemptMs: 1e4, maxRetries: 2 },
  hook: { budgetMs: 2e3, perAttemptMs: 1500, maxRetries: 0 }
};
function resolveModel(env) {
  return env["TYPESAFE_MODEL"]?.trim() || env["CLAUDE_PLUGIN_OPTION_MODEL"]?.trim() || env["REFEREE_MODEL"]?.trim() || DEFAULT_MODEL;
}
__name(resolveModel, "resolveModel");
function costUsd(model, inputTokens) {
  const price = USD_PER_MTOK[model];
  return price === void 0 ? null : inputTokens * price / 1e6;
}
__name(costUsd, "costUsd");
function estimateTokens(text) {
  return Math.ceil(text.length / 3);
}
__name(estimateTokens, "estimateTokens");

// src/engine/errors.ts
var RefereeError = class extends Error {
  static {
    __name(this, "RefereeError");
  }
  code;
  details;
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RefereeError";
    this.code = code;
    this.details = details;
  }
};
function isRefereeError(value) {
  return value instanceof RefereeError;
}
__name(isRefereeError, "isRefereeError");

// src/engine/pack.ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
function bundledPackDirs() {
  const here = dirname(fileURLToPath(import.meta.url));
  return [join(here, "packs"), join(here, "..", "packs"), join(here, "..", "..", "plugins", "claude-referee", "packs")];
}
__name(bundledPackDirs, "bundledPackDirs");
function packDirs(env, bundled = bundledPackDirs()) {
  const out = [];
  const setting = env["CLAUDE_PLUGIN_OPTION_PACKS_DIR"]?.trim();
  const fromEnv = env["REFEREE_PACKS_DIR"]?.trim();
  if (setting) out.push({ dir: setting, source: "setting" });
  if (fromEnv) out.push({ dir: fromEnv, source: "env" });
  for (const dir of bundled) if (existsSync(dir)) out.push({ dir, source: "bundled" });
  return out;
}
__name(packDirs, "packDirs");
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new RefereeError("bad_pack", `Pack file is not valid JSON: ${path.split(/[\\/]/).slice(-2).join("/")}`);
  }
}
__name(readJson, "readJson");
function listFiles(dir, ext) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : [];
}
__name(listFiles, "listFiles");
function hashDir(dir) {
  const hash = createHash("sha256");
  const walk = /* @__PURE__ */ __name((d, rel) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) walk(path, `${rel}${entry.name}/`);
      else if (entry.isFile()) hash.update(`${rel}${entry.name}\0`).update(readFileSync(path)).update("\0");
    }
  }, "walk");
  walk(dir, "");
  return hash.digest("hex").slice(0, 12);
}
__name(hashDir, "hashDir");
function checkQuestions(raw, file) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new RefereeError("bad_pack", `Questions file must be an object: ${file}`);
  for (const [id, q] of Object.entries(raw)) {
    const type = q.type;
    if (type !== "noul" && type !== "choice" && type !== "score") throw new RefereeError("bad_pack", `Question ${id} has no valid type.`);
  }
  return raw;
}
__name(checkQuestions, "checkQuestions");
function checkThresholds(raw) {
  const out = {};
  for (const [id, values] of Object.entries(raw ?? {})) {
    out[id] = {};
    for (const [k, v] of Object.entries(values ?? {})) {
      if (typeof v !== "number" || v < 0 || v > 1) throw new RefereeError("bad_pack", `Threshold ${id}.${k} must be a number from 0 to 1.`);
      out[id][k] = v;
    }
  }
  return out;
}
__name(checkThresholds, "checkThresholds");
function findPackDir(name, dirs) {
  for (const { dir } of dirs) {
    const candidate = join(dir, name);
    if (existsSync(join(candidate, "pack.json"))) return candidate;
  }
  return null;
}
__name(findPackDir, "findPackDir");
function loadPack(name, dirs, seen = []) {
  if (!NAME.test(name)) throw new RefereeError("pack_not_found", `Invalid pack name: ${name.slice(0, 64)}`);
  if (seen.includes(name)) throw new RefereeError("bad_pack", `Pack extends itself: ${[...seen, name].join(" > ")}`);
  const dir = findPackDir(name, dirs);
  if (!dir) {
    throw new RefereeError("pack_not_found", `Pack not found: ${name}`, { next_step: "Check the pack name in .claude/referee.json and the packs_dir setting." });
  }
  const meta = readJson(join(dir, "pack.json"));
  const parent = typeof meta.extends === "string" ? loadPack(meta.extends, dirs, [...seen, name]) : null;
  const questions = { ...parent?.questions };
  for (const file of listFiles(join(dir, "questions"), ".json")) Object.assign(questions, checkQuestions(readJson(join(dir, "questions", file)), file));
  const thresholds = { ...parent?.thresholds, ...existsSync(join(dir, "thresholds.json")) ? checkThresholds(readJson(join(dir, "thresholds.json"))) : {} };
  const cheatsheet = { ...parent?.cheatsheet };
  for (const file of listFiles(join(dir, "cheatsheet"), ".md")) cheatsheet[file.replace(/\.md$/, "")] = readFileSync(join(dir, "cheatsheet", file), "utf8");
  const own = existsSync(join(dir, "redact.json")) ? readJson(join(dir, "redact.json")) : void 0;
  const redact3 = parent?.redact || own ? { stop: [...parent?.redact?.stop ?? [], ...own?.stop ?? []], replace: [...parent?.redact?.replace ?? [], ...own?.replace ?? []] } : void 0;
  const areas = existsSync(join(dir, "areas.json")) ? readJson(join(dir, "areas.json")) : parent?.areas;
  return {
    name,
    version: typeof meta.version === "string" ? meta.version : "0.0.0",
    model: typeof meta.model === "string" ? meta.model : parent?.model ?? "",
    dir,
    hash: hashDir(dir),
    questions,
    thresholds,
    cheatsheet,
    redact: redact3,
    areas
  };
}
__name(loadPack, "loadPack");
function listPacks(dirs) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const { dir, source } of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || seen.has(entry.name) || !existsSync(join(dir, entry.name, "pack.json"))) continue;
      seen.add(entry.name);
      const meta = readJson(join(dir, entry.name, "pack.json"));
      out.push({ name: entry.name, version: typeof meta.version === "string" ? meta.version : "0.0.0", hash: hashDir(join(dir, entry.name)), source });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
__name(listPacks, "listPacks");
function threshold(pack, project, question3, key, fallback) {
  const base2 = pack.thresholds[question3]?.[key] ?? fallback;
  const override = project?.[question3]?.[key];
  return typeof override === "number" && override > base2 ? Math.min(override, 1) : base2;
}
__name(threshold, "threshold");
function thresholdBelow(pack, project, question3, key, fallback) {
  const base2 = pack.thresholds[question3]?.[key] ?? fallback;
  const override = project?.[question3]?.[key];
  return typeof override === "number" && override < base2 ? Math.max(override, 0) : base2;
}
__name(thresholdBelow, "thresholdBelow");

// src/cli/shared.ts
import { readFileSync as readFileSync6, statSync as statSync2 } from "node:fs";
import { resolve as resolve2 } from "node:path";

// src/engine/output.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";
function roundNumber(key, value) {
  if (Number.isInteger(value)) return value;
  if (key.endsWith("_usd")) return Number(value.toFixed(6));
  return Math.floor(value * 100 + 1e-9) / 100;
}
__name(roundNumber, "roundNumber");
function roundDeep(value, key = "") {
  if (typeof value === "number") return roundNumber(key, value);
  if (Array.isArray(value)) return value.map((item) => roundDeep(item, key));
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== void 0) out[k] = roundDeep(v, k);
    }
    return out;
  }
  return value;
}
__name(roundDeep, "roundDeep");
function isScalar(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}
__name(isScalar, "isScalar");
function summarize(result, path) {
  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (k === "receipt") continue;
    if (isScalar(v) && JSON.stringify(v).length <= 300) out[k] = v;
  }
  out["details"] = path;
  if (result["receipt"] !== void 0) out["receipt"] = result["receipt"];
  return out;
}
__name(summarize, "summarize");
function render(result, options = {}) {
  const rounded = roundDeep(result);
  if (options.pretty) return JSON.stringify(rounded, null, 2);
  const line = JSON.stringify(rounded);
  if (line.length <= DETAIL_LIMIT || !options.detailsDir || !options.receipt) return line;
  const path = join2(options.detailsDir, `${options.receipt}.json`);
  try {
    mkdirSync(options.detailsDir, { recursive: true });
    writeFileSync(path, JSON.stringify(rounded, null, 2) + "\n");
  } catch {
    return line;
  }
  return JSON.stringify(summarize(rounded, path));
}
__name(render, "render");
function renderError(error, pretty = false) {
  const body = { ok: false, error: error.code, message: error.message.slice(0, 500) };
  if (error.details.status !== void 0) body["status"] = error.details.status;
  if (error.details.retry_after_ms !== void 0) body["retry_after_ms"] = error.details.retry_after_ms;
  if (error.details.next_step !== void 0) body["next_step"] = error.details.next_step.slice(0, 600);
  const text = pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body);
  return text.length <= ERROR_LIMIT ? text : JSON.stringify({ ok: false, error: error.code });
}
__name(renderError, "renderError");

// src/engine/project.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname2, join as join3, relative, sep } from "node:path";
function readProjectFile(path) {
  try {
    const raw = JSON.parse(readFileSync2(path, "utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("not an object");
    return raw;
  } catch {
    throw new RefereeError("bad_project", `Project file is not a JSON object: .claude/${path.split(/[\\/]/).pop()}`);
  }
}
__name(readProjectFile, "readProjectFile");
function checkAreas(raw) {
  if (raw === void 0) return void 0;
  if (!Array.isArray(raw)) throw new RefereeError("bad_project", "areas must be an array.");
  return raw.map((a) => {
    if (typeof a?.prefix !== "string" || !Array.isArray(a.checks) || !a.checks.every((c) => typeof c === "string")) {
      throw new RefereeError("bad_project", "Each area needs a prefix string and a checks array of strings.");
    }
    return {
      prefix: a.prefix,
      checks: a.checks,
      ...Array.isArray(a.evidence) ? { evidence: a.evidence.filter((e) => typeof e === "string") } : {},
      ...typeof a.pack === "string" ? { pack: a.pack } : {}
    };
  });
}
__name(checkAreas, "checkAreas");
function findProjectFile(cwd) {
  let dir = cwd;
  for (; ; ) {
    const file = join3(dir, ".claude", "referee.json");
    if (existsSync2(file)) return file;
    const parent = dirname2(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
__name(findProjectFile, "findProjectFile");
function loadProject(cwd) {
  const file = findProjectFile(cwd);
  if (!file) return null;
  const base2 = readProjectFile(file);
  const localFile = join3(dirname2(file), "referee.local.json");
  const local = existsSync2(localFile) ? readProjectFile(localFile) : {};
  const merged = { ...base2, ...local, hooks: { ...base2.hooks, ...local.hooks } };
  if (typeof merged.pack !== "string" || !merged.pack) throw new RefereeError("bad_project", 'The project file needs a pack name, for example {"pack": "generic"}.');
  const gate = merged.hooks?.stopGate;
  return {
    root: dirname2(dirname2(file)),
    pack: merged.pack,
    areas: checkAreas(merged.areas),
    hooks: {
      sessionStart: merged.hooks?.sessionStart !== false,
      stopGate: gate === "shadow" || gate === "soft" || gate === "active" ? gate : "off",
      preModelSwitch: merged.hooks?.preModelSwitch === true
    },
    thresholds: typeof merged.thresholds === "object" && merged.thresholds !== null ? merged.thresholds : void 0
  };
}
__name(loadProject, "loadProject");

// src/engine/breaker.ts
import { mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join4 } from "node:path";
var LIMIT = 3;
var STALE_MS = 24 * 60 * 60 * 1e3;
var BREAKER_CODES = /* @__PURE__ */ new Set(["timeout", "service_unavailable", "rate_limited"]);
function read(dataDir) {
  try {
    const state = JSON.parse(readFileSync3(join4(dataDir, "breaker.json"), "utf8"));
    return state && typeof state.sessions === "object" && state.sessions !== null ? state : { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}
__name(read, "read");
function breakerOpen(dataDir, sessionId) {
  return (read(dataDir).sessions[sessionId]?.failures ?? 0) >= LIMIT;
}
__name(breakerOpen, "breakerOpen");
function recordBreaker(dataDir, sessionId, ok, now) {
  const state = read(dataDir);
  for (const [id, entry] of Object.entries(state.sessions)) if (now - entry.ts > STALE_MS) delete state.sessions[id];
  if (ok) delete state.sessions[sessionId];
  else state.sessions[sessionId] = { failures: (state.sessions[sessionId]?.failures ?? 0) + 1, ts: now };
  try {
    mkdirSync2(dataDir, { recursive: true });
    writeFileSync2(join4(dataDir, "breaker.json"), JSON.stringify(state));
  } catch {
    return;
  }
}
__name(recordBreaker, "recordBreaker");

// src/engine/cache.ts
import { createHash as createHash2 } from "node:crypto";
import { mkdirSync as mkdirSync3, readFileSync as readFileSync4, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join5 } from "node:path";
function sha256(text) {
  return createHash2("sha256").update(text).digest("hex");
}
__name(sha256, "sha256");
function cacheKey(parts) {
  return sha256(JSON.stringify([parts.pack, parts.packVersion, parts.model, parts.questions, parts.state]));
}
__name(cacheKey, "cacheKey");
function readCache(dataDir, key, now, ttlMs) {
  try {
    const entry = JSON.parse(readFileSync4(join5(dataDir, "cache", `${key}.json`), "utf8"));
    return now - entry.ts <= ttlMs ? entry : null;
  } catch {
    return null;
  }
}
__name(readCache, "readCache");
function writeCache(dataDir, key, entry) {
  try {
    const dir = join5(dataDir, "cache");
    mkdirSync3(dir, { recursive: true });
    writeFileSync3(join5(dir, `${key}.json`), JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}
__name(writeCache, "writeCache");

// src/engine/classify.ts
var BY_NAME = {
  APITimeoutError: "timeout",
  APIConnectionError: "service_unavailable",
  RateLimitError: "rate_limited",
  AuthenticationError: "auth_failed",
  PermissionDeniedError: "auth_failed",
  BadRequestError: "bad_request",
  UnprocessableEntityError: "bad_request",
  NotFoundError: "bad_request",
  InternalServerError: "service_unavailable",
  APIUserAbortError: "timeout",
  AbortError: "timeout"
};
var MESSAGES = {
  timeout: ["Jev did not answer in time.", "Try again later; the verdict is unknown, not negative."],
  service_unavailable: ["The TypeSafe API could not be reached.", "Check the network, then try again later."],
  rate_limited: ["The TypeSafe rate limit was hit.", "Wait and try again, or send fewer requests at once."],
  auth_failed: ["TypeSafe rejected the API key.", "Check the key's source with the doctor command and store a valid key."],
  bad_request: ["TypeSafe rejected the request.", "Run the same command with --dry-run to inspect what would be sent."],
  internal: ["Unexpected error while calling Jev.", "Run the doctor command and retry once."]
};
function byStatus(status) {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 429) return "rate_limited";
  if (status === 408) return "timeout";
  if (status === 400 || status === 404 || status === 422) return "bad_request";
  if (status >= 500) return "service_unavailable";
  return void 0;
}
__name(byStatus, "byStatus");
function byMessage(message) {
  if (/timed? ?out|timeout/i.test(message)) return "timeout";
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|socket|network/i.test(message)) return "service_unavailable";
  return void 0;
}
__name(byMessage, "byMessage");
function classify(error, context = {}) {
  if (error instanceof RefereeError) return error;
  const e = typeof error === "object" && error !== null ? error : {};
  const status = typeof e.status === "number" ? e.status : void 0;
  const code = (typeof e.name === "string" ? BY_NAME[e.name] : void 0) ?? (status !== void 0 ? byStatus(status) : void 0) ?? byMessage(typeof e.message === "string" ? e.message : String(error)) ?? "internal";
  const [message, generic] = MESSAGES[code] ?? MESSAGES.internal ?? ["Unexpected error.", ""];
  const raw = typeof e.message === "string" ? e.message : "";
  const next = code === "bad_request" && context.model && /\bunknown model\b/i.test(raw) ? `TypeSafe doesn't know the model "${context.model.slice(0, 80)}". Run doctor --online to list the models your key can use.` : generic;
  return new RefereeError(code, message, {
    next_step: next,
    ...status !== void 0 ? { status } : {},
    ...code === "rate_limited" && typeof e.retryAfterMs === "number" ? { retry_after_ms: e.retryAfterMs } : {}
  });
}
__name(classify, "classify");

// src/engine/client.ts
import { setTimeout as sleep2 } from "node:timers/promises";
var SDK_RETRY_STATUSES = /* @__PURE__ */ new Set([408, ...Array.from({ length: 100 }, (_, i) => 500 + i)]);
function rateLimitWait(error, attempt) {
  const e = typeof error === "object" && error !== null ? error : {};
  if (e.name !== "RateLimitError") return void 0;
  return typeof e.retryAfterMs === "number" ? e.retryAfterMs : Math.min(500 * 2 ** attempt, 5e3);
}
__name(rateLimitWait, "rateLimitWait");
var stderrLogger = {
  debug: /* @__PURE__ */ __name(() => {
  }, "debug"),
  info: /* @__PURE__ */ __name(() => {
  }, "info"),
  warn: /* @__PURE__ */ __name((message) => void process.stderr.write(`[claude-referee] ${message}
`), "warn"),
  error: /* @__PURE__ */ __name((message) => void process.stderr.write(`[claude-referee] ${message}
`), "error")
};
async function guarded(options, fn, model) {
  const sdk = await Promise.resolve().then(() => (init_dist(), dist_exports));
  const endsAt = Date.now() + options.budget.budgetMs;
  const budgetSignal = AbortSignal.timeout(options.budget.budgetMs);
  const signal = options.signal ? AbortSignal.any([options.signal, budgetSignal]) : budgetSignal;
  try {
    const client = new sdk.TypeSafeClient({
      apiKey: options.key,
      logLevel: "warn",
      logger: stderrLogger,
      timeout: options.budget.perAttemptMs,
      retry: { maxRetries: options.budget.maxRetries, httpStatuses: SDK_RETRY_STATUSES },
      ...options.baseURL ? { baseURL: options.baseURL } : {}
    });
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(client, signal);
      } catch (error) {
        const wait = rateLimitWait(error, attempt);
        if (wait === void 0 || attempt >= options.budget.maxRetries || wait >= endsAt - Date.now()) throw error;
        await sleep2(wait, void 0, { signal });
      }
    }
  } catch (error) {
    if (budgetSignal.aborted) {
      throw new RefereeError("timeout", `Jev did not answer within ${options.budget.budgetMs} ms.`, {
        next_step: "Try again later; the verdict is unknown, not negative."
      });
    }
    throw classify(error, model ? { model } : {});
  }
}
__name(guarded, "guarded");
function callJev(call, options) {
  return guarded(options, async (client, signal) => {
    const { data, requestId } = await client.systemOne({ state: call.state, questions: call.questions, model: call.model }, { signal }).withResponse();
    return {
      answers: data.answers,
      model: data.model,
      inputTokens: data.usage.input_tokens,
      requestId
    };
  }, call.model);
}
__name(callJev, "callJev");
function listModels(options) {
  return guarded(options, async (client, signal) => (await client.models.list({ signal })).map((m) => m.name));
}
__name(listModels, "listModels");

// src/engine/datadir.ts
import { execFileSync } from "node:child_process";
import { createHash as createHash3 } from "node:crypto";
import { readdirSync as readdirSync2, realpathSync, statSync } from "node:fs";
import { join as join6, resolve } from "node:path";
function pluginDataId() {
  return `${KIT}@${MARKETPLACE}`.replace(/[^A-Za-z0-9_-]/g, "-");
}
__name(pluginDataId, "pluginDataId");
function resolveDataDir(env, home, cwd, flag) {
  if (flag) return resolve(cwd, flag);
  const fromEnv = env["CLAUDE_PLUGIN_DATA"]?.trim() || env["REFEREE_DATA_DIR"]?.trim();
  if (fromEnv) return fromEnv;
  const configDir = env["CLAUDE_CONFIG_DIR"]?.trim() || join6(home, ".claude");
  return join6(configDir, "plugins", "data", pluginDataId());
}
__name(resolveDataDir, "resolveDataDir");
function projectRoot(cwd) {
  let root = cwd;
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2e3 }).trim() || cwd;
  } catch {
    root = cwd;
  }
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
}
__name(projectRoot, "projectRoot");
function projectId(cwd) {
  return createHash3("sha256").update(projectRoot(cwd)).digest("hex").slice(0, 12);
}
__name(projectId, "projectId");
function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = readdirSync2(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const path = join6(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(path);
    else if (entry.isFile()) total += statSync(path).size;
  }
  return total;
}
__name(dirSize, "dirSize");
function tildify(path, home) {
  return home && path.startsWith(home) ? "~" + path.slice(home.length) : path;
}
__name(tildify, "tildify");

// src/engine/key.ts
import { execFile } from "node:child_process";
var runCommand = /* @__PURE__ */ __name((file, args, timeoutMs) => new Promise((resolve7) => {
  execFile(
    file,
    [...args],
    { timeout: timeoutMs, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 },
    (error, stdout) => resolve7(error ? null : stdout)
  );
}), "runCommand");
var processMemo = /* @__PURE__ */ new Map();
function splitCommand(command) {
  const out = [];
  let current = "";
  let quote = null;
  let started = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) out.push(current);
      current = "";
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (quote) throw new RefereeError("invalid_api_key", "TYPESAFE_API_KEY_CMD has an unclosed quote.");
  if (started) out.push(current);
  return out;
}
__name(splitCommand, "splitCommand");
function validateKey(raw, source) {
  const key = raw.trim();
  if (/[^\x21-\x7e]/.test(key)) {
    throw new RefereeError("invalid_api_key", `The key from ${source} contains spaces, control characters or non-ASCII characters.`, {
      next_step: "Store the key again, without extra characters."
    });
  }
  return key;
}
__name(validateKey, "validateKey");
function noKeyNextStep(platform) {
  const hooks = "Hooks can also use /plugin configure claude-referee or claude plugin configure claude-referee --values-stdin (Claude Code 2.1.285+).";
  if (platform === "darwin") {
    return `Store the key in the Keychain: security add-generic-password -a "$USER" -s TYPESAFE_API_KEY -w (it prompts for the key). ${hooks}`;
  }
  if (platform === "linux") {
    return `Set TYPESAFE_API_KEY, or TYPESAFE_API_KEY_CMD="secret-tool lookup service typesafe" (not yet tested). ${hooks}`;
  }
  return `Set TYPESAFE_API_KEY (Windows is not yet tested). ${hooks}`;
}
__name(noKeyNextStep, "noKeyNextStep");
async function resolveKey(env, platform, runner = runCommand, memo = processMemo) {
  const direct = [
    ["plugin_setting", env["CLAUDE_PLUGIN_OPTION_API_KEY"]],
    ["TYPESAFE_API_KEY", env["TYPESAFE_API_KEY"]],
    ["EVAL_TYPESAFE_API_KEY", env["EVAL_TYPESAFE_API_KEY"]]
  ];
  for (const [source, value] of direct) {
    if (value?.trim()) return { key: validateKey(value, source), source };
  }
  const command = env["TYPESAFE_API_KEY_CMD"]?.trim();
  if (command) {
    const [file, ...args] = splitCommand(command);
    if (file) {
      if (!memo.has(command)) memo.set(command, runner(file, args, 5e3));
      const out = await memo.get(command);
      if (out?.trim()) return { key: validateKey(out, "TYPESAFE_API_KEY_CMD"), source: "TYPESAFE_API_KEY_CMD" };
    }
  }
  if (platform === "darwin") {
    const out = await runner("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], 5e3);
    if (out?.trim()) return { key: validateKey(out, "keychain"), source: "keychain" };
  }
  throw new RefereeError("no_api_key", "No TypeSafe API key found.", { next_step: noKeyNextStep(platform) });
}
__name(resolveKey, "resolveKey");
function isTypeSafeHost(baseUrl) {
  const raw = baseUrl?.trim();
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "api.typesafe.ai" && url.port === "";
  } catch {
    return false;
  }
}
__name(isTypeSafeHost, "isTypeSafeHost");
async function resolveEndpointKey(env, platform, runner = runCommand, memo = processMemo) {
  if (isTypeSafeHost(env["TYPESAFE_BASE_URL"])) return resolveKey(env, platform, runner, memo);
  const own = env["REFEREE_BASE_URL_KEY"];
  if (own?.trim()) return { key: validateKey(own, "REFEREE_BASE_URL_KEY"), source: "REFEREE_BASE_URL_KEY" };
  throw new RefereeError("no_api_key", "TYPESAFE_BASE_URL points away from api.typesafe.ai, and the TypeSafe key is never sent to another host.", {
    next_step: "Set REFEREE_BASE_URL_KEY to the key for that host, or unset TYPESAFE_BASE_URL."
  });
}
__name(resolveEndpointKey, "resolveEndpointKey");

// src/engine/receipts.ts
import { appendFileSync, existsSync as existsSync3, mkdirSync as mkdirSync4, readdirSync as readdirSync3, readFileSync as readFileSync5, rmSync } from "node:fs";
import { join as join7 } from "node:path";
function newReceiptId(now, random = Math.random) {
  const tail = Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0");
  return `r${now.toString(36)}${tail}`;
}
__name(newReceiptId, "newReceiptId");
function receiptsDir(dataDir) {
  return join7(dataDir, "receipts");
}
__name(receiptsDir, "receiptsDir");
function chainLines(dataDir, project) {
  const dir = join7(receiptsDir(dataDir), project);
  if (!existsSync3(dir)) return [];
  return readdirSync3(dir).filter((f) => f.endsWith(".jsonl")).sort().flatMap((f) => readFileSync5(join7(dir, f), "utf8").split("\n")).filter((l) => l.trim());
}
__name(chainLines, "chainLines");
function appendReceipt(dataDir, receipt) {
  try {
    const dir = join7(receiptsDir(dataDir), receipt.project);
    mkdirSync4(dir, { recursive: true });
    const last = chainLines(dataDir, receipt.project).at(-1);
    const chained = last === void 0 ? receipt : { ...receipt, prev: sha256(last) };
    appendFileSync(join7(dir, `${receipt.ts.slice(0, 7)}.jsonl`), JSON.stringify(chained) + "\n");
    return true;
  } catch {
    return false;
  }
}
__name(appendReceipt, "appendReceipt");
function readReceipts(dataDir, project) {
  const root = receiptsDir(dataDir);
  if (!existsSync3(root)) return [];
  const projects = project ? [project] : readdirSync3(root);
  const out = [];
  for (const p of projects.sort()) {
    const dir = join7(root, p);
    if (!existsSync3(dir)) continue;
    for (const file of readdirSync3(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
      for (const line of readFileSync5(join7(dir, file), "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          out.push(JSON.parse(line));
        } catch {
          continue;
        }
      }
    }
  }
  return out;
}
__name(readReceipts, "readReceipts");
function verifyChain(dataDir, project) {
  const root = receiptsDir(dataDir);
  const projects = project ? [project] : existsSync3(root) ? readdirSync3(root).sort() : [];
  let receipts2 = 0;
  let chained = 0;
  const breaks = [];
  for (const p of projects) {
    const seen = [];
    for (const line of chainLines(dataDir, p)) {
      receipts2 += 1;
      let r = null;
      try {
        r = JSON.parse(line);
      } catch {
        breaks.push({ project: p, id: "?", kind: "unreadable" });
      }
      if (r?.prev !== void 0) {
        chained += 1;
        if (r.prev !== seen.at(-1)) breaks.push({ project: p, id: r.id, kind: seen.includes(r.prev) ? "fork" : "mismatch" });
      }
      seen.push(sha256(line));
    }
  }
  return { receipts: receipts2, chained, unchained: receipts2 - chained, breaks };
}
__name(verifyChain, "verifyChain");
function overrulePath(dataDir) {
  return join7(dataDir, "overruled.jsonl");
}
__name(overrulePath, "overrulePath");
function readOverruled(dataDir) {
  try {
    return new Set(
      readFileSync5(overrulePath(dataDir), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l).id)
    );
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
__name(readOverruled, "readOverruled");
function overruleReceipt(dataDir, id, ts) {
  const receipt = readReceipts(dataDir).find((r) => r.id === id);
  if (!receipt) return null;
  mkdirSync4(dataDir, { recursive: true });
  if (!readOverruled(dataDir).has(id)) appendFileSync(overrulePath(dataDir), JSON.stringify({ id, ts }) + "\n");
  let dropped = 0;
  for (const key of receipt.cache_keys ?? []) {
    const file = join7(dataDir, "cache", `${key}.json`);
    if (existsSync3(file)) {
      rmSync(file, { force: true });
      dropped += 1;
    }
  }
  return { dropped };
}
__name(overruleReceipt, "overruleReceipt");

// src/engine/redact.ts
var STOP = [
  { kind: "private_key", regex: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/ },
  { kind: "aws_access_key", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: "github_token", regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/ },
  { kind: "slack_token", regex: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { kind: "anthropic_key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { kind: "openai_key", regex: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/ },
  { kind: "typesafe_key", regex: /\bapikey_[0-9a-f]{16,}_[0-9a-f]{16,}/i },
  { kind: "jwt", regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { kind: "url_credentials", regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/i }
];
var ASSIGNMENT = /([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*[:=]\s*["'`]?([^\s"'`,;)}\]]+)/g;
var SECRET_NAME = /key|token|secret|passw(?:or)?d|pwd/i;
var NOT_SECRET_NAME = /page|cursor|next|continuation|label|placeholder|hint|length|type|name|algorithm/i;
var ID_NAME = /(?:[_.-](?:id|ID)|Id|ID)$/;
var IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
var TYPE_NAME = /^[A-Z]?[a-z]+(?:[A-Z][a-z0-9]*)*$/;
var SECRET_CHARS = /^[A-Za-z0-9+/=_\-.~!@#$%^&*]+$/;
var MEMBER_CHAIN = /^[A-Za-z_$]+(?:\.[A-Za-z_$]+)+$/;
var PLACEHOLDER = /^(?:x{3,}|\*{3,}|\.{3}|changeme|your[_-].*|example.*|dummy.*|fake.*|test.*|placeholder.*|redacted.*|\$.*|process\.env.*|env\..*)$/i;
var EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
var IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
function looksSecret(name, value) {
  if (!SECRET_NAME.test(name) || NOT_SECRET_NAME.test(name) || ID_NAME.test(name)) return false;
  if (value.length < 12 || !SECRET_CHARS.test(value)) return false;
  if (IDENTIFIER.test(value) || TYPE_NAME.test(value) || MEMBER_CHAIN.test(value) || PLACEHOLDER.test(value)) return false;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  return classes >= 3 || classes >= 2 && value.length >= 20 && /[0-9]/.test(value);
}
__name(looksSecret, "looksSecret");
function compile(specs, global) {
  return (specs ?? []).map((spec) => {
    try {
      const flags = [...new Set(((spec.flags ?? "") + (global ? "g" : "")).split(""))].join("");
      return { kind: spec.kind, regex: new RegExp(spec.pattern, flags) };
    } catch {
      throw new RefereeError("bad_pack", `Invalid redaction pattern for ${spec.kind}.`);
    }
  });
}
__name(compile, "compile");
function stopsIn(text, extra) {
  const kinds = [];
  for (const { kind, regex } of [...STOP, ...extra]) {
    if (regex.test(text)) kinds.push(kind);
  }
  for (const match of text.matchAll(ASSIGNMENT)) {
    if (looksSecret(match[1] ?? "", match[2] ?? "")) {
      kinds.push("secret_assignment");
      break;
    }
  }
  return kinds;
}
__name(stopsIn, "stopsIn");
function isVersionContext(text, start, end) {
  const before = text.slice(Math.max(0, start - 10), start);
  const after = text.slice(end, end + 2);
  return /(?:\bv|version|ver|@|=|[\d.])\s*$/i.test(before) || /^(?:\.\d|[-+][0-9A-Za-z])/.test(after);
}
__name(isVersionContext, "isVersionContext");
function replaceIn(text, home, extra, counts3) {
  const bump = /* @__PURE__ */ __name((kind) => {
    counts3[kind] = (counts3[kind] ?? 0) + 1;
  }, "bump");
  let out = text;
  if (home && home.length > 1 && out.includes(home)) {
    out = out.split(home).join("~");
    bump("home");
  }
  out = out.replace(EMAIL, () => {
    bump("email");
    return "[REDACTED:email]";
  });
  out = out.replace(IPV4, (match, offset, whole) => {
    if (isVersionContext(whole, offset, offset + match.length)) return match;
    bump("ip");
    return "[REDACTED:ip]";
  });
  for (const { kind, regex } of extra) {
    out = out.replace(regex, () => {
      bump(kind);
      return `[REDACTED:${kind}]`;
    });
  }
  return out;
}
__name(replaceIn, "replaceIn");
function redact2(value, options = {}) {
  const extraStop = compile(options.extra?.stop, false);
  const extraReplace = compile(options.extra?.replace, true);
  const maxField = options.maxField ?? 6e4;
  const replaced = {};
  const stopped = [];
  const walk = /* @__PURE__ */ __name((node, field) => {
    if (typeof node === "string") {
      for (const kind of stopsIn(node, extraStop)) stopped.push({ kind, field });
      const clipped = node.length > maxField ? `${node.slice(0, maxField)}[TRUNCATED:${node.length - maxField}]` : node;
      return replaceIn(clipped, options.home, extraReplace, replaced);
    }
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${field}[${i}]`));
    if (node !== null && typeof node === "object") {
      const out = {};
      for (const [key, child] of Object.entries(node)) {
        for (const kind of stopsIn(key, extraStop)) stopped.push({ kind, field: `${field}.<key>` });
        const base2 = options.keepKeys ? key : replaceIn(key, options.home, extraReplace, replaced);
        let safeKey = base2;
        for (let n = 2; Object.hasOwn(out, safeKey); n++) safeKey = `${base2}#${n}`;
        out[safeKey] = walk(child, field ? `${field}.${safeKey}` : safeKey);
      }
      return out;
    }
    return node;
  }, "walk");
  return { value: walk(value, ""), replaced, stopped };
}
__name(redact2, "redact");
function stopError(stopped) {
  const first = stopped[0];
  const where = first ? `${first.kind} in ${first.field || "input"}` : "credential";
  return new RefereeError("credential_in_state", `Request not sent: found something shaped like a credential (${where}).`, {
    next_step: "Remove the credential from the input, or run with --dry-run to see what would be sent."
  });
}
__name(stopError, "stopError");

// src/engine/session.ts
function questionHash(questions) {
  return sha256(JSON.stringify(questions)).slice(0, 12);
}
__name(questionHash, "questionHash");
function stateHash(state) {
  return sha256(JSON.stringify(state)).slice(0, 12);
}
__name(stateHash, "stateHash");
function redactRequest(p, home, extra) {
  const options = { home, extra };
  const count = /* @__PURE__ */ __name((replaced) => Object.values(replaced).reduce((a, b) => a + b, 0), "count");
  const state = redact2({ state: p.state }, options);
  const questions = redact2({ questions: p.questions }, { ...options, keepKeys: true });
  return {
    body: { state: state.value.state, questions: questions.value.questions },
    stops: [...state.stopped, ...questions.stopped],
    replaced: count(state.replaced) + count(questions.replaced)
  };
}
__name(redactRequest, "redactRequest");
var Session = class {
  static {
    __name(this, "Session");
  }
  model;
  dataDir;
  receiptId;
  options;
  started;
  inflight = /* @__PURE__ */ new Map();
  keyPromise;
  requests = 0;
  cachedCount = 0;
  inputTokens = 0;
  cost = 0;
  replacedCount = 0;
  stoppedCount = 0;
  answeredModel;
  unsaved = false;
  requestIds = [];
  questionHashes = /* @__PURE__ */ new Set();
  cacheKeys = /* @__PURE__ */ new Set();
  constructor(options) {
    this.options = options;
    this.started = options.now();
    this.model = resolveModel(options.env);
    this.dataDir = resolveDataDir(options.env, options.home, options.cwd, options.dataDir);
    this.receiptId = newReceiptId(this.started);
  }
  prepare(planned) {
    return planned.map((p) => {
      const { body, stops, replaced } = redactRequest(p, this.options.home, this.options.pack.redact);
      this.replacedCount += replaced;
      this.questionHashes.add(questionHash(p.questions));
      return { planned: p, body, stops };
    });
  }
  dryRun(planned) {
    const prepared = this.prepare(planned);
    const stops = prepared.flatMap((p) => p.stops);
    if (stops.length > 0) throw stopError(stops);
    const bodies = prepared.map((p) => ({ id: p.planned.id, model: this.model, ...p.body }));
    const estTokens = bodies.reduce((sum2, b) => sum2 + estimateTokens(JSON.stringify(b)), 0);
    return { ok: true, verdict: "would_send", dry_run: true, requests: bodies.length, est_tokens: estTokens, replaced: this.replacedCount, sent: bodies };
  }
  async run(planned, options = {}) {
    const prepared = this.prepare(planned);
    const stops = prepared.flatMap((p) => p.stops);
    if (stops.length > 0 && !options.batch) throw stopError(stops);
    const partial = options.batch === true || options.partial === true;
    const deadline = partial ? AbortSignal.timeout(this.options.deadlineMs ?? BATCH_DEADLINE_MS) : void 0;
    const outcomes = new Array(prepared.length);
    const failures = [];
    let next = 0;
    const worker = /* @__PURE__ */ __name(async () => {
      while (next < prepared.length) {
        const index = next++;
        const item = prepared[index];
        if (!item) continue;
        if (!partial) {
          outcomes[index] = await this.one(item);
          continue;
        }
        try {
          if (deadline?.aborted) throw new RefereeError("timeout", "The batch deadline passed.");
          outcomes[index] = await this.one(item, deadline);
        } catch (error) {
          const known = classify(error);
          failures.push(known);
          outcomes[index] = { id: item.planned.id, answers: null, stopped: [], cached: false, error: known.code };
        }
      }
    }, "worker");
    const width = Math.max(1, Math.min(options.concurrency ?? 6, prepared.length));
    await Promise.all(Array.from({ length: width }, worker));
    const [firstFailure] = failures;
    if (firstFailure && !outcomes.some((o) => o.answers !== null)) throw firstFailure;
    return outcomes;
  }
  async one(item, signal) {
    const id = item.planned.id;
    if (item.stops.length > 0) {
      this.stoppedCount += 1;
      return { id, answers: null, stopped: item.stops, cached: false };
    }
    const pack = this.options.pack;
    const key = cacheKey({ pack: pack.name, packVersion: pack.version, model: this.model, questions: item.body.questions, state: item.body.state });
    this.cacheKeys.add(key);
    if (!this.options.fresh) {
      const hit = readCache(this.dataDir, key, this.options.now(), CACHE_TTL_MS);
      if (hit) {
        this.cachedCount += 1;
        this.answeredModel = hit.model;
        return { id, answers: hit.answers, stopped: [], cached: true };
      }
    }
    let pending = this.inflight.get(key);
    if (!pending) {
      pending = this.call(item.body, key, signal);
      this.inflight.set(key, pending);
    } else {
      this.cachedCount += 1;
    }
    const reply = await pending;
    return { id, answers: reply.answers, stopped: [], cached: false };
  }
  async call(body, key, signal) {
    const breakerSession = this.options.profile === "hook" ? this.options.sessionId : void 0;
    if (breakerSession && breakerOpen(this.dataDir, breakerSession)) {
      throw new RefereeError("breaker_open", "Skipped: Jev failed three times in a row in this session.", { next_step: "Hooks skip Jev until the session ends; the CLI still calls it." });
    }
    this.keyPromise ??= resolveEndpointKey(this.options.env, this.options.platform);
    const { key: apiKey } = await this.keyPromise;
    let reply;
    try {
      reply = await callJev(
        { state: body.state, questions: body.questions, model: this.model },
        { key: apiKey, budget: PROFILES[this.options.profile ?? "cli"], baseURL: this.options.env["TYPESAFE_BASE_URL"], signal }
      );
    } catch (error) {
      if (breakerSession && isRefereeError(error) && BREAKER_CODES.has(error.code)) recordBreaker(this.dataDir, breakerSession, false, this.options.now());
      throw error;
    }
    if (breakerSession) recordBreaker(this.dataDir, breakerSession, true, this.options.now());
    this.requests += 1;
    this.inputTokens += reply.inputTokens;
    this.cost += costUsd(reply.model, reply.inputTokens) ?? 0;
    this.answeredModel = reply.model;
    if (reply.requestId) this.requestIds.push(reply.requestId);
    if (!writeCache(this.dataDir, key, { ts: this.options.now(), model: reply.model, answers: reply.answers, inputTokens: reply.inputTokens })) this.unsaved = true;
    return reply;
  }
  stats() {
    return { requests: this.requests, cached: this.cachedCount };
  }
  saved() {
    return !this.unsaved;
  }
  record(fields = {}) {
    const env = this.options.env;
    const receipt = {
      id: this.receiptId,
      ts: new Date(this.options.now()).toISOString(),
      command: this.options.command,
      project: projectId(this.options.cwd),
      pack: this.options.pack.name,
      model: this.answeredModel ?? this.model,
      ...fields.verdict !== void 0 ? { verdict: fields.verdict } : {},
      ...fields.error !== void 0 ? { error: fields.error.code } : {},
      requests: this.requests,
      cached: this.cachedCount,
      input_tokens: this.inputTokens,
      cost_usd: Number(this.cost.toFixed(8)),
      ...this.requestIds.length > 0 ? { request_ids: this.requestIds } : {},
      ...this.questionHashes.size > 0 ? { qhash: [...this.questionHashes].sort().join(",") } : {},
      ...this.cacheKeys.size > 0 ? { cache_keys: [...this.cacheKeys].sort() } : {},
      ...this.options.fresh ? { fresh: true } : {},
      ...this.stoppedCount > 0 ? { stopped: this.stoppedCount } : {},
      ...this.replacedCount > 0 ? { replaced: this.replacedCount } : {},
      ...fields.chars !== void 0 ? { chars: fields.chars } : {},
      ms: Math.max(0, this.options.now() - this.started),
      ...env["EVAL_RUN_ID"] ? { run_id: env["EVAL_RUN_ID"] } : {},
      ...this.options.sessionId ? { session_id: this.options.sessionId } : {}
    };
    if (!appendReceipt(this.dataDir, receipt)) this.unsaved = true;
    return receipt;
  }
};

// src/cli/shared.ts
var JEV_COST = "One Jev request per input at $0.042 per million input tokens; output tokens are free. Repeats come from the local cache.";
var JEV_ERRORS = [
  "bad_input",
  "no_api_key",
  "invalid_api_key",
  "auth_failed",
  "rate_limited",
  "timeout",
  "service_unavailable",
  "bad_request",
  "credential_in_state",
  "pack_not_found",
  "bad_pack",
  "bad_project",
  "too_large"
];
var JEV_EFFECTS = "Sends the redacted input to the TypeSafe API unless --dry-run; writes a receipt and cache entries to the data directory.";
function str(context, key) {
  const value = context.values[key];
  return typeof value === "string" ? value : void 0;
}
__name(str, "str");
function list(context, key) {
  const value = context.values[key];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  return typeof value === "string" ? [value] : [];
}
__name(list, "list");
async function readSource(context, source, what) {
  if (source === void 0 || source === "-") {
    const text = await context.io.readStdin();
    if (!text.trim()) throw new RefereeError("bad_input", `No ${what} on stdin.`, { next_step: `Pipe the ${what} in, or pass a file path.` });
    return text;
  }
  const path = resolve2(context.io.cwd, source);
  try {
    if (statSync2(path).size > 5e6) throw new RefereeError("too_large", `The ${what} file is larger than 5 MB.`);
    return readFileSync6(path, "utf8");
  } catch (error) {
    if (isRefereeError(error)) throw error;
    throw new RefereeError("bad_input", `Cannot read the ${what} file: ${source}`);
  }
}
__name(readSource, "readSource");
function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}
__name(stripAnsi, "stripAnsi");
function clip(text, head, tail) {
  if (text.length <= head + tail) return text;
  return `${text.slice(0, head)}
[… ${text.length - head - tail} characters omitted …]
${text.slice(-tail)}`;
}
__name(clip, "clip");
function openPack(context) {
  const project = loadProject(context.io.cwd);
  const name = context.flags.pack ?? context.io.env["REFEREE_PACK"]?.trim() ?? project?.pack ?? "generic";
  return { pack: loadPack(name || "generic", packDirs(context.io.env)), project };
}
__name(openPack, "openPack");
function question(pack, id) {
  const q = pack.questions[id];
  if (!q) throw new RefereeError("bad_pack", `Pack ${pack.name} has no question ${id}.`);
  return q;
}
__name(question, "question");
function withData(instructions, data) {
  const base2 = typeof instructions === "object" && instructions !== null && !Array.isArray(instructions) ? instructions : { question: instructions };
  return { ...base2, ...data };
}
__name(withData, "withData");
async function jevCommand(context, command, pack, planned, finish, options = {}) {
  const { io, flags } = context;
  const session = new Session({
    command,
    env: io.env,
    cwd: io.cwd,
    home: io.home,
    platform: io.platform,
    now: io.now,
    pack: { name: pack.name, version: `${pack.version}+${pack.hash}`, redact: pack.redact },
    dataDir: flags.dataDir,
    fresh: flags.fresh
  });
  if (flags.dryRun) {
    const result = session.dryRun(planned);
    return flags.pretty ? result : fitLine(result);
  }
  try {
    const outcomes = await session.run(planned, options);
    const result = finish(outcomes, session);
    const receipt = session.record(typeof result["verdict"] === "string" ? { verdict: result["verdict"] } : {});
    if (!session.saved()) io.warn("[claude-referee] Could not write to the data directory; this run was not cached or logged.\n");
    if (flags.verbose) io.warn(JSON.stringify({ requests: receipt.requests, cached: receipt.cached, input_tokens: receipt.input_tokens, cost_usd: receipt.cost_usd, model: receipt.model, ms: receipt.ms }) + "\n");
    return reorder({ ...result, ...session.stats(), receipt: receipt.id });
  } catch (error) {
    if (isRefereeError(error)) session.record({ error });
    throw error;
  }
}
__name(jevCommand, "jevCommand");
function shorten(value, max) {
  if (typeof value === "string") return value.length > max ? clip(value, Math.floor(max / 2), Math.floor(max / 2)) : value;
  if (Array.isArray(value)) return value.map((item) => shorten(item, max));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shorten(v, max)]));
  return value;
}
__name(shorten, "shorten");
function fitLine(result) {
  const fits = /* @__PURE__ */ __name((candidate) => JSON.stringify(roundDeep(candidate)).length <= DETAIL_LIMIT, "fits");
  if (fits(result)) return result;
  const sent = Array.isArray(result["sent"]) ? result["sent"] : [];
  for (const max of [1e3, 400, 160, 60]) {
    const candidate = { ...result, sent: shorten(sent, max) };
    if (fits(candidate)) return candidate;
  }
  const short = shorten(sent, 60);
  let low = 0;
  let high = short.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits({ ...result, sent: short.slice(0, mid), sent_shown: mid })) low = mid;
    else high = mid - 1;
  }
  return { ...result, sent: short.slice(0, low), sent_shown: low };
}
__name(fitLine, "fitLine");
function reorder(result) {
  const { ok, verdict, next_step, receipt, ...rest } = result;
  return { ok, verdict, ...rest, next_step, receipt };
}
__name(reorder, "reorder");

// src/cli/commands/decide.ts
var NAME2 = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;
var FILE_LIMIT = 1e5;
var FILES_LIMIT = 2e5;
function parseInput(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new RefereeError("bad_input", "decide expects a JSON object.", { next_step: "Run decide --describe for the input shape." });
  }
  const bad = /* @__PURE__ */ __name((message) => new RefereeError("bad_input", message, { next_step: "Run decide --describe for the input shape." }), "bad");
  if (typeof raw["decision"] !== "string" || !raw["decision"].trim()) throw bad("decision must be a non-empty string.");
  if (!Array.isArray(raw["options"]) || raw["options"].length < 2 || raw["options"].length > 6) throw bad("options must list 2 to 6 options.");
  const options = raw["options"].map((o, i) => {
    if (typeof o === "string" && o.trim()) return { name: `o${i + 1}`, text: o };
    const { name, text: body } = o ?? {};
    if (typeof name !== "string" || !NAME2.test(name)) throw bad(`Option ${i + 1} needs a short name: letters, digits, '_', '.', '-'.`);
    if (/^\d+$/.test(name)) {
      throw new RefereeError("bad_input", `Option ${i + 1} is named "${name}"; a name made only of digits loses its place in the reversed order.`, {
        next_step: "Use a name that starts with a letter, e.g. o1."
      });
    }
    if (typeof body !== "string" || !body.trim()) throw bad(`Option ${name} needs a text.`);
    return { name, text: body };
  });
  if (new Set(options.map((o) => o.name)).size !== options.length) throw bad("Option names must be unique.");
  const files = raw["context_files"] ?? [];
  if (!Array.isArray(files) || !files.every((f) => typeof f === "string")) throw bad("context_files must be an array of paths.");
  const micro = (Array.isArray(raw["micro"]) ? raw["micro"] : []).map((m, i) => {
    const { id, question: q, bad: isBad } = m ?? {};
    if (typeof q !== "string" || !q.trim()) throw bad(`micro[${i}] needs a question.`);
    return { id: typeof id === "string" && NAME2.test(id) ? id : `m${i + 1}`, question: q, bad: isBad === true };
  });
  if (micro.length > 8) throw bad("At most 8 micro questions.");
  return {
    decision: raw["decision"],
    context: typeof raw["context"] === "string" && raw["context"].trim() ? raw["context"] : void 0,
    files,
    options,
    micro
  };
}
__name(parseInput, "parseInput");
function readContextFiles(context, files) {
  const contents = {};
  const read2 = [];
  let total = 0;
  for (const file of files) {
    const path = resolve3(context.io.cwd, file);
    let bytes;
    try {
      bytes = statSync3(path).size;
    } catch {
      throw new RefereeError("bad_input", `Cannot read context file: ${file}`);
    }
    if (bytes > FILE_LIMIT) throw new RefereeError("too_large", `Context file over 100 KB: ${file}`, { next_step: "Pass a smaller excerpt in context instead." });
    total += bytes;
    if (total > FILES_LIMIT) throw new RefereeError("too_large", "Context files over 200 KB in total.", { next_step: "Pass fewer or smaller files." });
    contents[file] = readFileSync7(path, "utf8");
    read2.push({ path: file, bytes });
  }
  return { contents, read: read2 };
}
__name(readContextFiles, "readContextFiles");
function argmax(p) {
  return Object.entries(p).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
__name(argmax, "argmax");
var decide = {
  name: "decide",
  describe: {
    summary: "Score 2-6 options against your context, asking in two option orders.",
    inputs: {
      "stdin or --in <file>": 'JSON: {"decision": string, "options": [{"name", "text"}] or [string], "context"?: string, "context_files"?: [path], "micro"?: [{"id", "question", "bad"?}]}',
      name: "Up to 40 letters, digits, '_', '.', '-'; not only digits.",
      context_files: "Read by the CLI, so Claude doesn't retype them. Max 100 KB each, 200 KB in total.",
      micro: `Optional yes/no rules asked once per option; reported in flags, never part of the verdict. bad: true means yes is bad. Without micro, a pack's decide.micro.* questions are used; a threshold of {"bad": 1} marks yes as bad.`
    },
    outputs: {
      verdict: "clear, weak or tie",
      lean: "The option with the highest mean probability",
      p: "Mean probability per option name across both orders (per_option mode: normalised fit score)",
      order_disagrees: "True when the two orders picked different leaders; the verdict can't be clear then",
      mode: "per_option when the options don't fit one request",
      read: "Context files read, with sizes",
      flags: "Micro rules that failed, by option and rule id",
      next_step: "For weak and tie: add the missing fact; don't ask again"
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: `${JEV_COST} decide makes 2 requests, plus one per option with micro questions.`
  },
  options: { in: { type: "string" } },
  async run(context) {
    const input = parseInput(await readSource(context, str(context, "in"), "decision JSON"));
    const { contents, read: read2 } = readContextFiles(context, input.files);
    const { pack, project } = openPack(context);
    const state = {
      decision: input.decision,
      ...input.context ? { context: input.context } : {},
      ...read2.length ? { context_files: contents } : {}
    };
    const stateTokens = estimateTokens(JSON.stringify(state));
    if (stateTokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", "The context is too large for one Jev request.", { next_step: "Trim context or context_files." });
    const best = question(pack, "decide.best");
    const ask = /* @__PURE__ */ __name((options) => ({ best: { ...best, criteria: Object.fromEntries(options.map((o) => [o.name, o.text])) } }), "ask");
    const questionTokens = estimateTokens(JSON.stringify(ask(input.options)));
    const perOption = stateTokens + questionTokens > Math.min(STATE_TOKEN_LIMIT, REQUEST_TOKEN_LIMIT);
    const fit = question(pack, "decide.fit");
    const planned = perOption ? input.options.map((o) => ({ id: `fit:${o.name}`, state: { ...state, option: o.text }, questions: { fit } })) : [
      { id: "written", state, questions: ask(input.options) },
      { id: "reversed", state, questions: ask([...input.options].reverse()) }
    ];
    const packMicro = Object.entries(pack.questions).filter(([id, q]) => id.startsWith("decide.micro.") && q.type === "noul").map(([id]) => ({ id: id.slice("decide.micro.".length), question: "", bad: (pack.thresholds[id]?.["bad"] ?? 0) >= 1 }));
    const micros = input.micro.length > 0 ? input.micro : packMicro;
    if (micros.length > 0) {
      const micro = Object.fromEntries(
        micros.map((m) => [m.id, input.micro.length > 0 ? { type: "noul", instructions: m.question } : question(pack, `decide.micro.${m.id}`)])
      );
      for (const o of input.options) planned.push({ id: `micro:${o.name}`, state: { ...state, option: o.text }, questions: micro });
    }
    const qid = perOption ? "decide.fit" : "decide.best";
    const clearAt = threshold(pack, project?.thresholds, qid, "clear", 0.85);
    const margin = threshold(pack, project?.thresholds, qid, "margin", 0.1);
    return jevCommand(context, "decide", pack, planned, (outcomes) => {
      const byId = new Map(outcomes.map((o) => [o.id, o.answers]));
      const mean = {};
      let disagree = false;
      if (perOption) {
        for (const o of input.options) {
          const answer = byId.get(`fit:${o.name}`)?.["fit"];
          const levels = Array.isArray(fit.criteria) ? fit.criteria.length : 5;
          mean[o.name] = answer?.type === "score" ? answer.score / Math.max(levels - 1, 1) : 0;
        }
      } else {
        const probs = /* @__PURE__ */ __name((id) => {
          const answer = byId.get(id)?.["best"];
          return answer?.type === "choice" ? { ...answer.probabilities } : {};
        }, "probs");
        const written = probs("written");
        const reversed = probs("reversed");
        for (const o of input.options) mean[o.name] = ((written[o.name] ?? 0) + (reversed[o.name] ?? 0)) / 2;
        disagree = argmax(written) !== argmax(reversed);
      }
      const ranked = Object.entries(mean).sort((a, b) => b[1] - a[1]);
      const [lean = "", p1 = 0] = ranked[0] ?? [];
      const p2 = ranked[1]?.[1] ?? 0;
      const verdict = !disagree && atLeast(p1, clearAt) && atLeast(p1 - p2, margin) ? "clear" : !disagree && atLeast(p1 - p2, margin) ? "weak" : "tie";
      const flags = input.options.flatMap(
        (o) => micros.flatMap((m) => {
          const answer = byId.get(`micro:${o.name}`)?.[m.id];
          const p = answer?.type === "noul" ? answer.noul : null;
          return p !== null && (m.bad ? p >= 0.7 : p <= 0.3) ? [{ option: o.name, rule: m.id, p }] : [];
        })
      );
      const why = disagree ? "The two option orders picked different leaders. " : "";
      return {
        ok: true,
        verdict,
        lean,
        p: mean,
        ...perOption ? { mode: "per_option" } : { order_disagrees: disagree },
        ...read2.length ? { read: read2 } : {},
        ...flags.length ? { flags } : {},
        next_step: verdict === "clear" ? void 0 : `${why}Add the missing fact to context; if the decision is easy to undo, go with ${lean}. Asking the same question again won't change it.`
      };
    });
  }
};

// src/cli/commands/doctor.ts
function shownBaseUrl(raw) {
  const value = raw?.trim();
  if (!value) return void 0;
  let url;
  try {
    url = new URL(value);
  } catch {
    return "invalid";
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const shown = url.toString().replace(/\/+$/, "");
  return shown === DEFAULT_BASE_URL ? void 0 : shown;
}
__name(shownBaseUrl, "shownBaseUrl");
function nodeOk(version) {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  return major > 20 || major === 20 && minor >= 3;
}
__name(nodeOk, "nodeOk");
var doctor = {
  name: "doctor",
  describe: {
    summary: "Check Node, Claude Code, the key source, data directory, packs and model.",
    inputs: { "--online": "Also list the models the key can use (one free API call)." },
    outputs: {
      verdict: "ready or not_ready",
      key_source: "Where the key was found: REFEREE_BASE_URL_KEY (only for another host), plugin_setting, TYPESAFE_API_KEY, EVAL_TYPESAFE_API_KEY, TYPESAFE_API_KEY_CMD or keychain. Never the key.",
      packs: "Installed packs with version, content hash and source.",
      base_url: "Only when TYPESAFE_BASE_URL points somewhere other than the default; credentials and query are removed.",
      next_step: "What to fix when not ready."
    },
    errors: ["bad_input"],
    effects: "Reads only. With --online, one request to list models.",
    cost: "Free."
  },
  options: { online: { type: "boolean" } },
  async run({ io, flags, values }) {
    const node = process.version;
    const claude = (await runCommand("claude", ["--version"], 3e3))?.trim().split(/\s+/)[0] ?? null;
    let keySource = null;
    let keyError = null;
    let key = null;
    try {
      const resolved = await resolveEndpointKey(io.env, io.platform);
      keySource = resolved.source;
      key = resolved.key;
    } catch (error) {
      keyError = isRefereeError(error) ? error.code : "internal";
    }
    let models = null;
    let online = null;
    if (values["online"] === true && key) {
      try {
        models = await listModels({ key, budget: PROFILES.cli, baseURL: io.env["TYPESAFE_BASE_URL"] });
        online = "ok";
      } catch (error) {
        online = isRefereeError(error) ? error.code : "internal";
      }
    }
    const baseUrl = shownBaseUrl(io.env["TYPESAFE_BASE_URL"]);
    const dataDir = resolveDataDir(io.env, io.home, io.cwd, flags.dataDir);
    const projectFile = findProjectFile(io.cwd);
    const ready = nodeOk(node) && keySource !== null && (online === null || online === "ok");
    const nextStep = !nodeOk(node) ? "Install Node 20.3 or later on the PATH Claude Code uses." : keyError === "no_api_key" && !isTypeSafeHost(io.env["TYPESAFE_BASE_URL"]) ? "TYPESAFE_BASE_URL points away from api.typesafe.ai: set REFEREE_BASE_URL_KEY to that host's key, or unset TYPESAFE_BASE_URL. The TypeSafe key is never sent there." : keyError === "no_api_key" ? noKeyNextStep(io.platform) : keyError ? "The stored key is malformed; store it again." : online && online !== "ok" ? `The key check failed (${online}).` : void 0;
    return {
      ok: true,
      verdict: ready ? "ready" : "not_ready",
      version: VERSION,
      node,
      claude,
      key_source: keySource,
      ...keyError ? { key_error: keyError } : {},
      ...online ? { online } : {},
      ...models ? { models } : {},
      model: resolveModel(io.env),
      ...baseUrl ? { base_url: baseUrl } : {},
      data_dir: tildify(dataDir, io.home),
      data_bytes: dirSize(dataDir),
      packs: listPacks(packDirs(io.env)),
      project: projectFile ? tildify(projectFile, io.home) : null,
      next_step: nextStep
    };
  }
};

// src/engine/runners/compiled.ts
var ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;
var MAX_FAILING = 10;
var MAX_NAME = 120;
var MAX_SUMMARY = 200;
function prepare(text) {
  return text.replace(ANSI, "").split(/\r?\n/);
}
__name(prepare, "prepare");
function facts(runner, passed, failed, errors, skipped, ids, summary) {
  return {
    runner,
    passed,
    failed,
    errors,
    skipped,
    failing: [...ids].slice(0, MAX_FAILING).map((n) => n.slice(0, MAX_NAME)),
    summary_line: summary === null ? null : summary.trim().slice(0, MAX_SUMMARY)
  };
}
__name(facts, "facts");
function topLevel(ids) {
  const top = [...ids].filter((n) => !n.includes("/")).length;
  return top > 0 ? top : ids.size;
}
__name(topLevel, "topLevel");
var GO_PKG_OK = /^ok\s+\S+\s+(?:[\d.]+s\b|\(cached\))(.*)$/;
var GO_PKG_FAIL = /^FAIL\s+\S+\s+(?:[\d.]+s\b|\[(?:build|setup) failed\])/;
var GO_NO_FILES = /^\?\s+\S+\s+\[no test files\]/;
var GO_TEST = /^\s*--- (FAIL|PASS|SKIP): (\S+)/;
var GO_RUN = /^\s*=== (?:RUN|PAUSE|CONT)\s/;
var GO_RUN_ID = /^\s*=== RUN\s+(\S+)/;
var go = {
  name: "go test",
  parse(text) {
    const lines3 = prepare(text);
    const summaries = [];
    const failedIds = /* @__PURE__ */ new Set();
    const passedIds = /* @__PURE__ */ new Set();
    const skippedIds = /* @__PURE__ */ new Set();
    const startedIds = /* @__PURE__ */ new Set();
    let okPackages = 0;
    let failedPackages = 0;
    let buildFailed = 0;
    let other = false;
    let panic = false;
    let goroutine = false;
    let bareFail = false;
    let failFirst = null;
    let okLast = null;
    for (const line of lines3) {
      const ok = GO_PKG_OK.exec(line);
      if (ok) {
        summaries.push(line);
        okLast = line;
        if (!/\[no tests to run\]/.test(ok[1] ?? "")) okPackages++;
        continue;
      }
      if (GO_PKG_FAIL.test(line)) {
        summaries.push(line);
        failFirst ??= line;
        if (/\[(?:build|setup) failed\]/.test(line)) buildFailed++;
        else failedPackages++;
        continue;
      }
      if (GO_NO_FILES.test(line)) {
        summaries.push(line);
        continue;
      }
      const t = GO_TEST.exec(line);
      if (t) {
        other = true;
        const id = t[2];
        if (t[1] === "FAIL") failedIds.add(id);
        else if (t[1] === "PASS") passedIds.add(id);
        else skippedIds.add(id);
        continue;
      }
      const started = GO_RUN_ID.exec(line);
      if (started) startedIds.add(started[1]);
      if (GO_RUN.test(line)) other = true;
      else if (/^panic: /.test(line)) panic = true;
      else if (/^goroutine \d+ \[/.test(line)) goroutine = true;
      else if (/^FAIL\s*$/.test(line)) bareFail = true;
    }
    const recognised = summaries.length > 0 || other || panic && goroutine;
    if (!recognised) return null;
    const unfinished = [...startedIds].some((id) => !failedIds.has(id) && !passedIds.has(id) && !skippedIds.has(id)) ? 1 : 0;
    const errors = buildFailed + unfinished + (panic && (goroutine || other || summaries.length > 0) ? 1 : 0);
    const failed = Math.max(failedPackages, topLevel(failedIds), bareFail && errors === 0 ? 1 : 0);
    if (summaries.length === 0 && failed === 0 && errors === 0) return null;
    const passed = Math.max(okPackages, topLevel(passedIds));
    const summary = summaries.length === 0 ? null : failFirst ?? okLast ?? summaries[summaries.length - 1];
    return facts("go test", passed, failed, errors, topLevel(skippedIds), failedIds, summary);
  }
};
var CARGO_RESULT = /^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored;/;
var CARGO_TEST = /^test (.+?) \.\.\. (ok|FAILED|ignored)\b/;
var CARGO_STDOUT = /^---- (.+?) stdout ----$/;
var CARGO_COMPILE = /^error\[E\d+\]/;
var CARGO_LIST_ITEM = /^ {4}([\w:]+|\S+ - .+ \(line \d+\))$/;
var cargo = {
  name: "cargo test",
  parse(text) {
    const lines3 = prepare(text);
    const results = [];
    const failedIds = /* @__PURE__ */ new Set();
    const compile3 = /* @__PURE__ */ new Set();
    let passed = 0;
    let failedSum = 0;
    let ignored = 0;
    let okLines = 0;
    let failedStatus = false;
    let failedFirst = null;
    let couldNotCompile = false;
    let testFailedLine = false;
    for (let i = 0; i < lines3.length; i++) {
      const line = lines3[i];
      const r = CARGO_RESULT.exec(line);
      if (r) {
        results.push(line);
        passed += Number(r[2]);
        failedSum += Number(r[3]);
        ignored += Number(r[4]);
        if (r[1] === "FAILED") {
          failedStatus = true;
          failedFirst ??= line;
        }
        continue;
      }
      const t = CARGO_TEST.exec(line);
      if (t) {
        if (t[2] === "FAILED") failedIds.add(t[1]);
        else if (t[2] === "ok") okLines++;
        continue;
      }
      const s = CARGO_STDOUT.exec(line);
      if (s) {
        failedIds.add(s[1]);
        continue;
      }
      if (/^failures:\s*$/.test(line)) {
        for (let j = i + 1; j < lines3.length; j++) {
          const item = CARGO_LIST_ITEM.exec(lines3[j]);
          if (!item) break;
          failedIds.add(item[1]);
        }
        continue;
      }
      if (CARGO_COMPILE.test(line)) compile3.add(line);
      else if (/^error: could not compile /.test(line)) couldNotCompile = true;
      else if (/^error: test failed, to rerun pass/.test(line)) testFailedLine = true;
    }
    const errors = compile3.size > 0 ? compile3.size : couldNotCompile ? 1 : 0;
    const failed = Math.max(failedSum, failedIds.size, failedStatus || testFailedLine ? 1 : 0);
    if (results.length === 0 && failed === 0 && errors === 0) return null;
    const summary = results.length === 0 ? null : failedFirst ?? results[results.length - 1];
    return facts("cargo test", results.length > 0 ? passed : okLines, failed, errors, ignored, failedIds, summary);
  }
};
var DOTNET_SUMMARY = /^\s*(Passed|Failed)!\s+-\s+Failed:\s*(\d+),\s*Passed:\s*(\d+),\s*Skipped:\s*(\d+),\s*Total:\s*(\d+)/;
var DOTNET_FAILED = /^\s+Failed (.+?) \[[^\]]*\]\s*$/;
var DOTNET_PASSED = /^\s+Passed (.+?) \[[^\]]*\]\s*$/;
var DOTNET_ERROR = /^(.*?)\s*(?:\[[^\]]*\.\w*proj\])?\s*$/;
var dotnet = {
  name: "dotnet test",
  parse(text) {
    const lines3 = prepare(text);
    const summaries = [];
    const failedIds = /* @__PURE__ */ new Set();
    const buildErrors = /* @__PURE__ */ new Set();
    let passed = 0;
    let failedSum = 0;
    let skipped = 0;
    let passedLines = 0;
    let failedStatus = false;
    let failedFirst = null;
    let noTests = null;
    let runFailed = false;
    let buildFailed = false;
    for (const line of lines3) {
      const s = DOTNET_SUMMARY.exec(line);
      if (s) {
        summaries.push(line);
        failedSum += Number(s[2]);
        passed += Number(s[3]);
        skipped += Number(s[4]);
        if (s[1] === "Failed") {
          failedStatus = true;
          failedFirst ??= line;
        }
        continue;
      }
      const f = DOTNET_FAILED.exec(line);
      if (f) {
        failedIds.add(f[1]);
        continue;
      }
      if (DOTNET_PASSED.test(line)) {
        passedLines++;
        continue;
      }
      if (/\berror [A-Z]{2,4}\d{3,5}:/.test(line)) {
        buildErrors.add((DOTNET_ERROR.exec(line)?.[1] ?? line).trim());
        continue;
      }
      if (/^\s*No test is available\b/.test(line)) noTests ??= line;
      else if (/^\s*Test Run Failed\.?\s*$/.test(line)) runFailed = true;
      else if (/^\s*Build FAILED\.?\s*$/.test(line)) buildFailed = true;
    }
    const errors = buildErrors.size > 0 ? buildErrors.size : buildFailed ? 1 : 0;
    const failed = Math.max(failedSum, failedIds.size, failedStatus || runFailed ? 1 : 0);
    const hasSummary = summaries.length > 0 || noTests !== null;
    if (!hasSummary && failed === 0 && errors === 0) return null;
    const summary = summaries.length > 0 ? failedFirst ?? summaries[summaries.length - 1] : noTests;
    return facts("dotnet test", summaries.length > 0 ? passed : passedLines, failed, errors, skipped, failedIds, summary);
  }
};
var parsers = [go, cargo, dotnet];

// src/engine/runners/util.ts
var ANSI2 = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;
var MAX_FAILING2 = 10;
var MAX_NAME2 = 120;
var MAX_SUMMARY2 = 200;
var prepare2 = /* @__PURE__ */ __name((text) => text.replace(ANSI2, "").split(/\r?\n/), "prepare");
var clip2 = /* @__PURE__ */ __name((value, max) => value.trim().slice(0, max), "clip");
function mk(runner, counts3, failing, summary, incomplete) {
  return {
    runner,
    passed: counts3.passed ?? 0,
    failed: counts3.failed ?? 0,
    errors: counts3.errors ?? 0,
    skipped: counts3.skipped ?? 0,
    ...counts3.warnings === void 0 ? {} : { warnings: counts3.warnings },
    ...incomplete ? { incomplete: true } : {},
    failing: [...failing].slice(0, MAX_FAILING2).map((n) => clip2(n, MAX_NAME2)),
    summary_line: summary === null ? null : clip2(summary, MAX_SUMMARY2)
  };
}
__name(mk, "mk");
function exitCodes(lines3) {
  const out = [];
  for (const line of lines3) {
    const m = /^.{0,60}?\bexit (?:code|status)\s*[:=]?\s*(-?\d+)/i.exec(line);
    if (m) out.push(Number(m[1]));
  }
  return out;
}
__name(exitCodes, "exitCodes");

// src/engine/runners/builds.ts
var BIOME_CHECKED = /^(?:Checked|Formatted|Linted) (\d+) files? in \S+?\.(?:\s+(.*))?$/;
var BIOME_FOUND = /^Found (\d+) (errors?|warnings?|infos?|diagnostics?)\.?\s*$/;
var BIOME_HEADER = /^(\S+?)(?::\d+:\d+)? (\S+)(?:\s+(?:FIXABLE|INTERNAL|DEPRECATED|UNUSED))*\s+━{3,}/;
var BIOME_CMD = /\bbiome (?:check|lint|ci|format)\b/;
var biome = {
  name: "biome",
  parse(text) {
    const lines3 = prepare2(text);
    let checked = null;
    let foundErrors = 0;
    let foundWarnings = 0;
    let bodyErrors = 0;
    let bodyWarnings = 0;
    let fixed = 0;
    let headers = 0;
    let cmd = false;
    let own = false;
    const failing = /* @__PURE__ */ new Set();
    for (const line of lines3) {
      const c = BIOME_CHECKED.exec(line);
      if (c) {
        checked = c;
        if (/^(?:No fixes applied\.|Fixed \d+ files?\.?)/.test(c[2] ?? "")) own = true;
        fixed += Number(/Fixed (\d+) files?/.exec(c[2] ?? "")?.[1] ?? 0);
        continue;
      }
      const f = BIOME_FOUND.exec(line);
      if (f) {
        const n = Number(f[1]);
        if (/^error/.test(f[2])) foundErrors += n;
        else foundWarnings += n;
        continue;
      }
      const h = BIOME_HEADER.exec(line);
      if (h) {
        headers++;
        failing.add(`${h[1]} ${h[2]}`);
        continue;
      }
      if (/^ {2}× (?!Some errors were emitted)/.test(line)) bodyErrors++;
      else if (/^ {2}! /.test(line)) bodyWarnings++;
      else if (BIOME_CMD.test(line)) cmd = true;
    }
    if (!own && headers === 0 && !cmd) return null;
    const errors = Math.max(foundErrors, bodyErrors);
    const warnings = Math.max(foundWarnings, bodyWarnings);
    const files = Number(checked?.[1] ?? 0);
    const summary = checked === null ? null : checked[0];
    return mk("biome", { passed: files, errors, warnings }, errors > 0 ? failing : [], summary, checked === null || files === 0 || fixed > 0);
  }
};
var NEXT_MARK = /^\s*\S{0,2}\s*Next\.js \d+\.\d+|Creating an optimized production build|^Route \((?:app|pages)\)|\bnext build\b/;
var NEXT_ROUTE = /^Route \((?:app|pages)\)/;
var NEXT_ERROR = /^(?:Failed to compile\.|> Build error occurred|Failed to type check\.|Type error: |> Build failed because of webpack errors|Error occurred prerendering page|Export encountered errors|Error: (?:Turbopack|Build|Export)\b|Next\.js build worker exited with code: [1-9]|\d+:\d+\s+Error: )|\berror TS\d+:|^Module not found: /;
var NEXT_WARNING = /^(?:\d+:\d+\s+Warning: |\s*⚠ )|Compiled with warnings/;
var nextBuild = {
  name: "next build",
  parse(text) {
    const lines3 = prepare2(text);
    if (!lines3.some((l) => NEXT_MARK.test(l))) return null;
    let errors = 0;
    let warnings = 0;
    let route = null;
    let compiled = null;
    for (const line of lines3) {
      if (NEXT_ROUTE.test(line)) route = line;
      else if (NEXT_ERROR.test(line)) errors++;
      else if (NEXT_WARNING.test(line)) warnings++;
      else if (/Compiled successfully/.test(line)) compiled = line;
    }
    return mk("next build", { errors, warnings }, [], errors > 0 ? null : route ?? compiled, route === null && errors === 0);
  }
};
var NIX_CMD = /\bnix(?:-build| build| flake check| flake build| develop)\b|\bnixos-rebuild\b/;
var NIX_FAILURE = /^error: (?:builder for '|Cannot build '|build of '|\d+ dependencies of derivation)/;
var nix = {
  name: "nix build",
  parse(text) {
    const lines3 = prepare2(text);
    const cmd = lines3.some((l) => NIX_CMD.test(l));
    if (!cmd && !lines3.some((l) => NIX_FAILURE.test(l))) return null;
    const errorLines = lines3.filter((l) => /^\s*error:(?:\s|$)/.test(l));
    const warnings = lines3.filter((l) => /^warning: /.test(l)).length;
    const codes = exitCodes(lines3);
    return mk("nix build", { errors: errorLines.length, warnings }, [], errorLines[0] ?? null, errorLines.length === 0 && codes.length === 0);
  }
};
var parsers2 = [biome, nextBuild, nix];

// src/engine/runners/js.ts
var ANSI3 = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
var MAX_FAILING3 = 10;
var MAX_NAME3 = 120;
var MAX_SUMMARY3 = 200;
function toLines(text) {
  return text.replace(ANSI3, "").split(/\r\n|\r|\n/);
}
__name(toLines, "toLines");
function clip3(line) {
  return line === null ? null : line.trim().slice(0, MAX_SUMMARY3);
}
__name(clip3, "clip");
function listFailing(ids) {
  const out = [];
  for (const raw of ids) {
    const id = raw.trim().slice(0, MAX_NAME3);
    if (id !== "" && !out.includes(id)) out.push(id);
    if (out.length === MAX_FAILING3) break;
  }
  return out;
}
__name(listFailing, "listFailing");
function countsOf(body) {
  const c = { passed: 0, failed: 0, skipped: 0 };
  for (const m of body.matchAll(/(\d+)\s+(failed|passed|skipped|todo|pending|total)\b/g)) {
    const n = Number(m[1]);
    if (m[2] === "failed") c.failed += n;
    else if (m[2] === "passed") c.passed += n;
    else if (m[2] !== "total") c.skipped += n;
  }
  return c;
}
__name(countsOf, "countsOf");
function tally(lines3, re) {
  const t = { line: null, last: { passed: 0, failed: 0, skipped: 0 }, failedMax: 0 };
  for (const l of lines3) {
    const m = re.exec(l);
    if (m === null) continue;
    t.line = l;
    t.last = countsOf(m[1] ?? "");
    t.failedMax = Math.max(t.failedMax, t.last.failed);
  }
  return t;
}
__name(tally, "tally");
function facts2(runner, f) {
  return { runner, passed: f.passed, failed: f.failed, errors: f.errors, skipped: f.skipped, failing: listFailing(f.failing), summary_line: clip3(f.summary) };
}
__name(facts2, "facts");
function parseJest(text) {
  const lines3 = toLines(text);
  const tests = tally(lines3, /^\s*Tests:\s+(?=.*\b\d+\s+(?:failed|passed|skipped|todo|total)\b)(\d.*)$/);
  const suites2 = tally(lines3, /^\s*Test Suites:\s+(\d.*)$/);
  const noTests = lines3.find((l) => /^\s*No tests found\b/.test(l)) ?? null;
  const ids = /* @__PURE__ */ new Set();
  const files = /* @__PURE__ */ new Set();
  let runErrors = 0;
  for (const l of lines3) {
    const h = /^\s*● (.+?)\s*$/.exec(l);
    if (h !== null) {
      const name = h[1] ?? "";
      if (/^Test suite failed to run\b/.test(name)) runErrors += 1;
      else if (!/^(?:Console|Validation Warning|Deprecation Warning)\b/.test(name)) ids.add(name);
      continue;
    }
    const f = /^\s*FAIL\s+(\S*[./]\S*)(?:\s+\(.*\))?\s*$/.exec(l);
    if (f !== null) files.add(f[1] ?? "");
  }
  if (tests.line === null && suites2.line === null && noTests === null && ids.size === 0 && files.size === 0 && runErrors === 0) return null;
  const failed = Math.max(tests.failedMax, ids.size, ids.size === 0 && runErrors === 0 ? files.size : 0);
  const errors = Math.max(runErrors, failed === 0 ? suites2.failedMax : 0);
  return facts2("jest", {
    passed: tests.last.passed,
    failed,
    errors,
    skipped: tests.last.skipped,
    failing: ids.size > 0 ? ids : files,
    summary: tests.line ?? suites2.line ?? noTests
  });
}
__name(parseJest, "parseJest");
function parseVitest(text) {
  const lines3 = toLines(text);
  const tests = tally(lines3, /^\s*Tests\s+(\d.*)$/);
  const files = tally(lines3, /^\s*Test Files\s+(\d.*)$/);
  const noFiles = lines3.find((l) => /^\s*No test files found\b/.test(l)) ?? null;
  const ids = /* @__PURE__ */ new Set();
  const loadFails = /* @__PURE__ */ new Set();
  const markedFiles = /* @__PURE__ */ new Set();
  let unhandled = 0;
  for (const l of lines3) {
    const f = /^\s*FAIL\s+(\S.*?)\s*$/.exec(l);
    if (f !== null) {
      const id = f[1] ?? "";
      if (id.includes(" > ")) ids.add(id);
      else if (/\[.*\]$/.test(id)) loadFails.add(id);
      continue;
    }
    const m = /^\s*❯ (\S+) \(\d+ tests?(?: \| (\d+) failed)?/.exec(l);
    if (m !== null && Number(m[2] ?? 0) > 0) {
      markedFiles.add(m[1] ?? "");
      continue;
    }
    const e = /^\s*Errors\s+(\d+) errors?\b/.exec(l);
    if (e !== null) unhandled = Math.max(unhandled, Number(e[1]));
  }
  const marked = ids.size + loadFails.size + markedFiles.size;
  if (tests.line === null && files.line === null && noFiles === null && marked === 0 && unhandled === 0) return null;
  const failed = Math.max(tests.failedMax, ids.size, ids.size === 0 && markedFiles.size > 0 ? markedFiles.size : 0);
  const errors = Math.max(loadFails.size, unhandled, failed === 0 ? files.failedMax : 0);
  return facts2("vitest", {
    passed: tests.last.passed,
    failed,
    errors,
    skipped: tests.last.skipped,
    failing: ids.size + loadFails.size > 0 ? [...ids, ...loadFails] : markedFiles,
    summary: tests.line ?? files.line ?? noFiles
  });
}
__name(parseVitest, "parseVitest");
function parseMocha(text) {
  const lines3 = toLines(text);
  let passLine = null;
  let failLine = null;
  let pendLine = null;
  let passIdx = -1;
  let pendIdx = -1;
  let failIdx = -1;
  let passed = 0;
  let skipped = 0;
  let failedMax = 0;
  let evidence = false;
  lines3.forEach((l, i) => {
    const m = /^\s*(\d+) (passing|failing|pending)\b/.exec(l);
    if (m !== null) {
      const n = Number(m[1]);
      if (m[2] === "passing") [passLine, passIdx, passed] = [l, i, n];
      else if (m[2] === "pending") [pendLine, pendIdx, skipped] = [l, i, n];
      else [failLine, failIdx, failedMax] = [l, i, Math.max(failedMax, n)];
    } else if (/^\s*[✔✓]\s/.test(l)) evidence = true;
  });
  if (pendIdx < passIdx) skipped = 0;
  const hasSummary = passLine !== null || failLine !== null || pendLine !== null;
  const ids = /* @__PURE__ */ new Map();
  if (hasSummary || evidence) {
    lines3.forEach((l, i) => {
      const m = /^\s{2,}(\d+)\) (\S.*?)\s*$/.exec(l);
      if (m === null) return;
      let name = m[2] ?? "";
      const next = i > failIdx && failIdx >= 0 ? /^\s{5,}(\S.*):\s*$/.exec(lines3[i + 1] ?? "") : null;
      if (next !== null) name = `${name} > ${next[1] ?? ""}`;
      ids.set(Number(m[1]), name);
    });
  }
  if (!hasSummary && ids.size === 0) return null;
  return facts2("mocha", {
    passed,
    failed: Math.max(failedMax, ids.size),
    errors: 0,
    skipped,
    failing: ids.values(),
    summary: passLine ?? failLine ?? pendLine
  });
}
__name(parseMocha, "parseMocha");
function parseEslint(text) {
  const lines3 = toLines(text);
  let summary = null;
  let errorsMax = 0;
  let warningsMax = 0;
  let file = "";
  const entries = /* @__PURE__ */ new Set();
  const warned = /* @__PURE__ */ new Set();
  let sawLine = false;
  for (const l of lines3) {
    const s = /^\s*[✖✔]\s+(\d+) problems?\s+\((\d+) errors?,\s*(\d+) warnings?\)/.exec(l);
    if (s !== null) {
      summary = l;
      errorsMax = Math.max(errorsMax, Number(s[2]));
      warningsMax = Math.max(warningsMax, Number(s[3]));
      continue;
    }
    const d = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.*?)(?:\s{2,}([@\w/.-]+))?\s*$/.exec(l);
    if (d !== null) {
      sawLine = true;
      if (d[3] === "error") entries.add(`${file === "" ? "" : `${file}:`}${d[1]}:${d[2]} ${d[5] ?? "error"}`);
      else warned.add(`${file}:${d[1]}:${d[2]}`);
      continue;
    }
    if (/^\S*[./\\]\S*$/.test(l)) file = l;
  }
  if (summary === null && !sawLine) return null;
  return { ...facts2("eslint", { passed: 0, failed: 0, errors: Math.max(errorsMax, entries.size), skipped: 0, failing: entries, summary }), warnings: Math.max(warningsMax, warned.size) };
}
__name(parseEslint, "parseEslint");
function parseTsc(text) {
  const lines3 = toLines(text);
  let summary = null;
  let errorsMax = 0;
  const entries = /* @__PURE__ */ new Set();
  for (const l of lines3) {
    const s = /^\s*(?:\[[^\]]*\]\s*)?Found (\d+) errors?\b/.exec(l);
    if (s !== null) {
      summary = l;
      errorsMax = Math.max(errorsMax, Number(s[1]));
      continue;
    }
    const a = /^\s*(\S+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):/.exec(l) ?? /^\s*(\S+?):(\d+):(\d+)\s+-\s+error\s+(TS\d+):/.exec(l);
    if (a !== null) {
      entries.add(`${a[1]}:${a[2]}:${a[3]} ${a[4]}`);
      continue;
    }
    const g2 = /^\s*error\s+(TS\d+):/.exec(l);
    if (g2 !== null) entries.add(g2[1] ?? "");
  }
  const build = lines3.some((l) => /^\s*(?:\[[^\]]*\]\s*)?(?:Projects in this build:|Building project ')/.test(l));
  if (summary === null && entries.size === 0 && !build) return null;
  const errors = Math.max(errorsMax, entries.size);
  return facts2("tsc", { passed: summary !== null && errors === 0 ? 1 : 0, failed: 0, errors, skipped: 0, failing: entries, summary });
}
__name(parseTsc, "parseTsc");
function parseNodeTest(text) {
  const lines3 = toLines(text);
  const num = /* @__PURE__ */ __name((key) => {
    const hit = [...lines3].reverse().map((l) => new RegExp(`^(?:ℹ|#) ${key} (\\d+)\\s*$`).exec(l)).find((m) => m !== null);
    return hit ? Number(hit[1]) : null;
  }, "num");
  const tests = num("tests");
  const pass = num("pass");
  const fail = num("fail");
  const ids = /* @__PURE__ */ new Set();
  let inFailing = false;
  for (const l of lines3) {
    if (/^✖ failing tests:\s*$/.test(l)) inFailing = true;
    const m = /^✖ (.+?) \(\d+(?:\.\d+)?ms\)\s*$/.exec(l);
    if (m !== null && !inFailing) ids.add(m[1]);
    const tap = /^not ok \d+ - (.+?)\s*$/.exec(l);
    if (tap !== null) ids.add(tap[1]);
  }
  const summary = tests !== null && pass !== null && fail !== null ? lines3.filter((l) => /^(?:ℹ|#) (?:tests|pass|fail) \d+\s*$/.test(l)).slice(-3).join(" ") : null;
  const failed = Math.max(fail ?? 0, ids.size);
  if (summary === null && failed === 0) return null;
  return facts2("node:test", { passed: pass ?? 0, failed, errors: 0, skipped: num("skipped") ?? 0, failing: ids, summary });
}
__name(parseNodeTest, "parseNodeTest");
var parsers3 = [
  { name: "jest", parse: parseJest },
  { name: "vitest", parse: parseVitest },
  { name: "mocha", parse: parseMocha },
  { name: "eslint", parse: parseEslint },
  { name: "tsc", parse: parseTsc },
  { name: "node:test", parse: parseNodeTest }
];

// src/engine/runners/more.ts
var ANSI4 = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;
var MAX_FAILING4 = 10;
var MAX_NAME4 = 120;
var MAX_SUMMARY4 = 200;
var prepare3 = /* @__PURE__ */ __name((text) => text.replace(ANSI4, "").split(/\r?\n/), "prepare");
var clip4 = /* @__PURE__ */ __name((value, max) => value.trim().slice(0, max), "clip");
var UT_RAN = /^Ran (\d+) tests? in [\d.]+s\s*$/;
var UT_RESULT = /^(OK|FAILED|NO TESTS RAN)(?: \(([^)]*)\))?\s*$/;
var UT_NAMED = /^(FAIL|ERROR): (.+?)\s*$/;
var UT_VERBOSE = /^\S.*\([\w.]+\) \.\.\. (ok|FAIL|ERROR|skipped\b.*|expected failure|unexpected success)\s*$/;
function utCount(detail, key) {
  const m = new RegExp(`(?:^|, )${key}=(\\d+)`).exec(detail ?? "");
  return m ? Number(m[1]) : 0;
}
__name(utCount, "utCount");
var unittest = {
  name: "unittest",
  parse(text) {
    const lines3 = prepare3(text);
    const names = /* @__PURE__ */ new Set();
    let best = null;
    let ok = 0;
    let verboseFail = 0;
    let verboseError = 0;
    let verboseSkip = 0;
    let verbose = 0;
    for (let i = 0; i < lines3.length; i++) {
      const line = lines3[i];
      const named = UT_NAMED.exec(line);
      if (named) {
        names.add(clip4(named[2], MAX_NAME4));
        continue;
      }
      const v = UT_VERBOSE.exec(line);
      if (v) {
        verbose++;
        if (v[1] === "ok") ok++;
        else if (v[1] === "FAIL") verboseFail++;
        else if (v[1] === "ERROR") verboseError++;
        else if (v[1]?.startsWith("skipped")) verboseSkip++;
        continue;
      }
      const ran = UT_RAN.exec(line);
      if (!ran) continue;
      for (let j = i + 1; j < Math.min(lines3.length, i + 4); j++) {
        const r = UT_RESULT.exec(lines3[j]);
        if (!r) continue;
        const detail = r[2];
        const summary = {
          ran: Number(ran[1]),
          failed: utCount(detail, "failures"),
          errors: utCount(detail, "errors"),
          skipped: utCount(detail, "skipped"),
          line: clip4(lines3[j], MAX_SUMMARY4)
        };
        if (r[1] === "FAILED" && summary.failed + summary.errors === 0) summary.failed = 1;
        if (best === null || summary.failed + summary.errors > best.failed + best.errors) best = summary;
        break;
      }
    }
    if (best === null && verbose === 0) return null;
    if (best === null) {
      return { runner: "unittest", passed: ok, failed: Math.max(verboseFail, 0), errors: verboseError, skipped: verboseSkip, failing: [...names].slice(0, MAX_FAILING4), summary_line: null };
    }
    const passed = Math.max(best.ran - best.failed - best.errors - best.skipped, 0);
    return { runner: "unittest", passed, failed: best.failed, errors: best.errors, skipped: best.skipped, failing: [...names].slice(0, MAX_FAILING4), summary_line: best.line };
  }
};
var CLIPPY_MARK = /\bcargo clippy\b|clippy::/;
var CLIPPY_GENERATED = /^warning: `[^`]+`(?: \([^)]*\))? generated (\d+) warnings?/;
var CLIPPY_WARNING = /^warning: (?!`[^`]+`(?: \([^)]*\))? generated )/;
var CLIPPY_ERROR = /^error(?:\[E\d+\])?: (?!could not compile|aborting due to)/;
var CLIPPY_COMPILE = /^error: could not compile `[^`]+`(?: \([^)]*\))?(?: due to (\d+) previous errors?)?/;
var clippy = {
  name: "clippy",
  parse(text) {
    const lines3 = prepare3(text);
    if (!lines3.some((l) => CLIPPY_MARK.test(l))) return null;
    let generated = 0;
    let headers = 0;
    let errorHeaders = 0;
    let dueTo = 0;
    let couldNot = false;
    let summary = null;
    for (const line of lines3) {
      const g2 = CLIPPY_GENERATED.exec(line);
      if (g2) {
        generated += Number(g2[1]);
        summary = clip4(line, MAX_SUMMARY4);
        continue;
      }
      if (CLIPPY_WARNING.test(line)) {
        headers++;
        continue;
      }
      const c = CLIPPY_COMPILE.exec(line);
      if (c) {
        couldNot = true;
        dueTo += Number(c[1] ?? 0);
        summary = clip4(line, MAX_SUMMARY4);
        continue;
      }
      if (CLIPPY_ERROR.test(line)) errorHeaders++;
    }
    const errors = Math.max(errorHeaders, dueTo, couldNot ? 1 : 0);
    const facts3 = { runner: "clippy", passed: 0, failed: 0, errors, skipped: 0, warnings: Math.max(generated, headers), failing: [], summary_line: summary };
    return facts3;
  }
};
var GOLANGCI_MARK = /\bgolangci-lint\b|\[runner\] Issues before processing/;
var GOLANGCI_ISSUE = /^\S+\.go:\d+:\d+: .+ \([\w-]+\)\s*$/;
var GOLANGCI_AFTER = /Issues before processing: \d+, after processing: (\d+)/;
var GOLANGCI_COUNT = /^(\d+) issues?:\s*$/;
var golangci = {
  name: "golangci-lint",
  parse(text) {
    const lines3 = prepare3(text);
    if (!lines3.some((l) => GOLANGCI_MARK.test(l))) return null;
    let after = 0;
    let counted = 0;
    let issues = 0;
    let summary = null;
    for (const line of lines3) {
      const a = GOLANGCI_AFTER.exec(line);
      if (a) {
        after = Math.max(after, Number(a[1]));
        summary ??= clip4(line, MAX_SUMMARY4);
        continue;
      }
      const c = GOLANGCI_COUNT.exec(line);
      if (c) {
        counted = Math.max(counted, Number(c[1]));
        summary = clip4(line, MAX_SUMMARY4);
        continue;
      }
      if (GOLANGCI_ISSUE.test(line)) issues++;
    }
    return { runner: "golangci-lint", passed: 0, failed: 0, errors: Math.max(after, counted, issues), skipped: 0, failing: [], summary_line: summary };
  }
};
var VITE_MARK = /^vite v\d+\.\d+(?:\.\d+)?\S* building\b/;
var VITE_BUILT = /^✓ built in \S+\s*$/;
var VITE_ERROR = /^(?:error during build:|✗ Build failed in\b|\[vite[:\]])/;
var VITE_WARN = /^\(!\) /;
var viteParser = {
  name: "vite",
  parse(text) {
    const lines3 = prepare3(text);
    if (!lines3.some((l) => VITE_MARK.test(l))) return null;
    let errors = 0;
    let warnings = 0;
    let built = null;
    for (const line of lines3) {
      if (VITE_BUILT.test(line)) built = clip4(line, MAX_SUMMARY4);
      else if (VITE_ERROR.test(line)) errors++;
      else if (VITE_WARN.test(line)) warnings++;
    }
    return { runner: "vite", passed: 0, failed: 0, errors, skipped: 0, warnings, failing: [], summary_line: errors > 0 ? null : built };
  }
};
var NEXTEST_MARK = /\bcargo[- ]nextest\b|^\s*Nextest run ID \S+ with nextest profile|^\s*Starting \d+ tests? across \d+ binar|^\s*Summary \[\s*[\d.]+s\] .*\btests? run:|test --no-run --message-format json-render-diagnostics/;
var CARGO_BUILD_CMD = /\bcargo (?:build|check)\b/;
var CARGO_PROGRESS = /^\s+(?:Compiling|Checking) \S+ v\d/;
var CARGO_FINISHED = /^\s+Finished `?\w+`? (?:profile|\[)/;
var cargoBuild = {
  name: "cargo build",
  parse(text) {
    const lines3 = prepare3(text);
    if (lines3.some((l) => CLIPPY_MARK.test(l) || NEXTEST_MARK.test(l))) return null;
    const marked = lines3.some((l) => CARGO_BUILD_CMD.test(l)) || lines3.some((l) => CARGO_PROGRESS.test(l)) && lines3.some((l) => CARGO_FINISHED.test(l) || CLIPPY_COMPILE.test(l));
    if (!marked || lines3.some((l) => /^running \d+ tests?$/.test(l))) return null;
    let generated = 0;
    let headers = 0;
    let errorHeaders = 0;
    let dueTo = 0;
    let couldNot = false;
    let summary = null;
    for (const line of lines3) {
      const g2 = CLIPPY_GENERATED.exec(line);
      if (g2) {
        generated += Number(g2[1]);
        summary = clip4(line, MAX_SUMMARY4);
        continue;
      }
      if (CLIPPY_WARNING.test(line)) {
        headers++;
        continue;
      }
      const c = CLIPPY_COMPILE.exec(line);
      if (c) {
        couldNot = true;
        dueTo += Number(c[1] ?? 0);
        summary = clip4(line, MAX_SUMMARY4);
        continue;
      }
      if (CLIPPY_ERROR.test(line)) errorHeaders++;
    }
    const errors = Math.max(errorHeaders, dueTo, couldNot ? 1 : 0);
    return { runner: "cargo build", passed: 0, failed: 0, errors, skipped: 0, warnings: Math.max(generated, headers), failing: [], summary_line: summary };
  }
};
var parsers4 = [unittest, clippy, golangci, viteParser, cargoBuild];

// src/engine/runners/php-ruby.ts
var MAX_FAILING5 = 10;
var MAX_NAME5 = 120;
var MAX_SUMMARY5 = 200;
function lines(text) {
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").split(/\r\n|\r|\n/).map((l) => l.replace(/\s+$/, ""));
}
__name(lines, "lines");
function cap(s, n) {
  const t = s.trim();
  return t.length > n ? t.slice(0, n) : t;
}
__name(cap, "cap");
function dedupeNames(names) {
  const out = [];
  for (const n of names) {
    const c = cap(n, MAX_NAME5);
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, MAX_FAILING5);
}
__name(dedupeNames, "dedupeNames");
function counts(rest) {
  const out = {};
  for (const m of rest.matchAll(/([A-Za-z][A-Za-z ]*?):\s*(\d+)/g)) {
    const key = m[1].toLowerCase();
    out[key] = Math.max(out[key] ?? 0, Number(m[2]));
  }
  return out;
}
__name(counts, "counts");
var phpunit = {
  name: "phpunit",
  parse(text) {
    const all = lines(text);
    const candidates = [];
    const failureIds = /* @__PURE__ */ new Map();
    const errorIds = /* @__PURE__ */ new Map();
    let section = null;
    let summaryFailures = 0;
    let summaryErrors = 0;
    let headerFailures = 0;
    let headerErrors = 0;
    let failFloor = 0;
    let errFloor = 0;
    let progressFail = false;
    all.forEach((line, index) => {
      let m;
      if (m = line.match(/^OK \((\d+) tests?, (\d+) assertions?\)/)) {
        candidates.push({ index, line, passed: Number(m[1]), skipped: 0 });
        section = null;
      } else if (/^OK, but .*!$/.test(line)) {
        candidates.push({ index, line, passed: 0, skipped: 0 });
        section = null;
      } else if (m = line.match(/^Tests:\s*(\d+)\s*(?:,(.*?))?\.?$/)) {
        const c = counts(m[2] ?? "");
        const failures = c["failures"] ?? 0;
        const errors2 = c["errors"] ?? 0;
        const skipped = (c["skipped"] ?? 0) + (c["incomplete"] ?? 0) + (c["risky"] ?? 0);
        summaryFailures = Math.max(summaryFailures, failures);
        summaryErrors = Math.max(summaryErrors, errors2);
        candidates.push({ index, line, passed: Math.max(0, Number(m[1]) - failures - errors2 - skipped), skipped });
        section = null;
      } else if (/^No tests executed!/.test(line)) {
        candidates.push({ index, line, passed: 0, skipped: 0 });
        section = null;
      } else if (/^FAILURES!$/.test(line)) {
        failFloor = 1;
        section = null;
      } else if (/^ERRORS!$/.test(line)) {
        errFloor = 1;
        section = null;
      } else if (m = line.match(/^There (?:was|were) (\d+) ([a-z ]+?)s?:$/i)) {
        const n = Number(m[1]);
        const kind = m[2].toLowerCase();
        if (kind === "failure") {
          section = "failure";
          headerFailures = Math.max(headerFailures, n);
        } else if (kind === "error") {
          section = "error";
          headerErrors = Math.max(headerErrors, n);
        } else section = "other";
      } else if (section === "failure" || section === "error") {
        if (m = line.match(/^(\d+)\) ([\w\\]+::\S.*)$/)) {
          (section === "failure" ? failureIds : errorIds).set(`${m[1]}) ${m[2]}`, m[2]);
        }
      } else if (/^[.FEWSIRDN]+\s+\d+ \/ \d+ \(\s*\d+%\)$/.test(line.trim())) {
        if (/[FE]/.test(line.trim().split(/\s+/)[0])) progressFail = true;
      }
    });
    const last = candidates[candidates.length - 1];
    let failed = Math.max(summaryFailures, failureIds.size, headerFailures, failFloor);
    const errors = Math.max(summaryErrors, errorIds.size, headerErrors, errFloor);
    if (failed === 0 && errors === 0 && progressFail) failed = 1;
    if (!last && failed === 0 && errors > 0) failed = errors;
    if (!last && failed === 0 && errors === 0) return null;
    return {
      runner: "phpunit",
      passed: last?.passed ?? 0,
      failed,
      errors,
      skipped: last?.skipped ?? 0,
      failing: dedupeNames([...failureIds.values(), ...errorIds.values()]),
      summary_line: last ? cap(last.line, MAX_SUMMARY5) : null
    };
  }
};
var rspec = {
  name: "rspec",
  parse(text) {
    const all = lines(text);
    const summaries = [];
    const numbered = /* @__PURE__ */ new Map();
    const located = /* @__PURE__ */ new Map();
    const loadErrors = /* @__PURE__ */ new Set();
    let section = null;
    let summaryFailures = 0;
    let summaryErrors = 0;
    let failuresHeader = false;
    all.forEach((line, index) => {
      let m;
      if (m = line.match(
        /^\s*(\d+) examples?, (\d+) failures?(?:, (\d+) pending)?(?:, (\d+) errors? occurred outside of examples)?\s*$/
      )) {
        const failures = Number(m[2]);
        const pending = Number(m[3] ?? 0);
        summaryFailures = Math.max(summaryFailures, failures);
        summaryErrors = Math.max(summaryErrors, Number(m[4] ?? 0));
        summaries.push({ index, line, passed: Math.max(0, Number(m[1]) - failures - pending), skipped: pending });
        section = null;
      } else if (/^Failures:$/.test(line)) {
        section = "failures";
        failuresHeader = true;
      } else if (/^Failed examples:$/.test(line)) {
        section = "failed";
      } else if (/^Pending:$/.test(line)) {
        section = "pending";
      } else if (/^Finished in /.test(line)) {
        section = null;
      } else if (m = line.match(/^rspec (\.?\/?\S+?:\d+(?:\[[\d:]+\])?|\.?\/\S+)\s*(?:#\s*(.*))?$/)) {
        located.set(m[1], `${m[1]}${m[2] ? ` # ${m[2]}` : ""}`);
      } else if (m = line.match(/^An error occurred while loading (\S+?)\.?$/)) {
        loadErrors.add(m[1]);
      } else if (section === "failures" && (m = line.match(/^\s*(\d+)\) (.+)$/))) {
        const lm = m[2].match(/^An error occurred while loading (\S+?)\.?$/);
        if (lm) loadErrors.add(lm[1]);
        numbered.set(`${m[1]}) ${m[2]}`, m[2]);
      }
    });
    const last = summaries[summaries.length - 1];
    const failureIds = [...numbered.values()].filter((n) => !/^An error occurred while loading /.test(n));
    const failed = Math.max(summaryFailures, failureIds.length, located.size, failuresHeader && loadErrors.size === 0 ? 1 : 0);
    const errors = Math.max(summaryErrors, loadErrors.size);
    if (!last && failed === 0 && errors === 0) return null;
    return {
      runner: "rspec",
      passed: last?.passed ?? 0,
      failed,
      errors,
      skipped: last?.skipped ?? 0,
      failing: dedupeNames(located.size > 0 ? [...located.values()] : [...numbered.values()]),
      summary_line: last ? cap(last.line, MAX_SUMMARY5) : null
    };
  }
};
var parsers5 = [phpunit, rspec];

// src/engine/runners/python.ts
var MAX_FAILING6 = 10;
var MAX_ENTRY = 120;
var MAX_SUMMARY6 = 200;
var ANSI5 = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
var TIME = String.raw`in \d+(?:\.\d+)?s(?: \(\d+:\d{2}:\d{2}\))?`;
var PYTEST_SUMMARY = new RegExp(String.raw`^(?:\d+ (?:failed|passed|skipped|deselected|xfailed|xpassed|warnings?|errors?|rerun)(?:, )?)+ ${TIME}$`);
var PYTEST_NO_TESTS = new RegExp(String.raw`^no tests ran ${TIME}$`);
var PYTEST_EMPTY = /^(?:=+\s*|collecting \.\.\. )?collected 0 items\b.*$/;
var PYTEST_COUNT = /(\d+) (failed|passed|skipped|errors?)\b/g;
var SHORT_LINE = /^(?:\[gw\d+\]\s+)?(?:\[\s*\d+%\]\s+)?(FAILED|ERROR)\s+(.+)$/;
var VERBOSE_LINE = /^([\w./\\-]+\.py::\S.*?)\s+(FAILED|ERROR)\b/;
var COLLECT_ERROR = /^_+ ERROR collecting (\S+\.py) _+$/;
var TEST_ID = /^[\w./\\-]+\.py(?:::\S.*)?$/;
var FAILURES_BLOCK = /^=+ FAILURES =+$/;
var ERRORS_BLOCK = /^=+ ERRORS =+$/;
var RUFF_FOUND = /^Found (\d+) errors?\.$/;
var RUFF_CLEAN = /^All checks passed!$/;
var RUFF_FIXABLE = /^\[\*\] (\d+) fixable with the .{0,4}--fix.{0,4} option/;
var RUFF_CONCISE = /^(\S+?):(\d+):(\d+): ([A-Z]{1,4}\d{2,4})(?: |$)/;
var RUFF_HEADER = /^([A-Z]{1,4}\d{2,4}) (?:\[\*\] )?\S/;
var RUFF_ARROW = /^\s*--> (\S+?):(\d+):(\d+)$/;
function lines2(text) {
  return text.replace(ANSI5, "").split(/\r\n|\r|\n/);
}
__name(lines2, "lines");
function cap2(value, max) {
  return value.length > max ? value.slice(0, max) : value;
}
__name(cap2, "cap");
function counts2(line) {
  const out = { failed: 0, passed: 0, skipped: 0, errors: 0 };
  for (const m of line.matchAll(PYTEST_COUNT)) {
    const key = (m[2] ?? "").startsWith("error") ? "errors" : m[2] ?? "";
    out[key] = Math.max(out[key] ?? 0, Number(m[1]));
  }
  return out;
}
__name(counts2, "counts");
var pytest = {
  name: "pytest",
  parse(text) {
    const failedIds = /* @__PURE__ */ new Set();
    const errorIds = /* @__PURE__ */ new Set();
    const summaries = [];
    let empty = null;
    let failuresBlock = false;
    let errorsBlock = false;
    for (const raw of lines2(text)) {
      const line = raw.trim();
      const bare = line.replace(/^=+\s*|\s*=+$/g, "");
      if (PYTEST_SUMMARY.test(bare) || PYTEST_NO_TESTS.test(bare)) {
        summaries.push(line);
        continue;
      }
      if (PYTEST_EMPTY.test(line)) {
        empty = line;
        continue;
      }
      if (FAILURES_BLOCK.test(line)) failuresBlock = true;
      else if (ERRORS_BLOCK.test(line)) errorsBlock = true;
      const collect = COLLECT_ERROR.exec(line);
      if (collect) {
        errorIds.add(collect[1] ?? "");
        continue;
      }
      const short = SHORT_LINE.exec(line);
      if (short) {
        const id = (short[2] ?? "").split(" - ")[0]?.trim() ?? "";
        if (TEST_ID.test(id)) (short[1] === "FAILED" ? failedIds : errorIds).add(id);
        continue;
      }
      const verbose = VERBOSE_LINE.exec(line);
      if (verbose) (verbose[2] === "FAILED" ? failedIds : errorIds).add(verbose[1] ?? "");
    }
    const markers = failedIds.size + errorIds.size > 0 || failuresBlock || errorsBlock;
    if (summaries.length === 0 && empty === null && !markers) return null;
    let failed = Math.max(failedIds.size, failuresBlock ? 1 : 0);
    let errors = Math.max(errorIds.size, errorsBlock ? 1 : 0);
    for (const s of summaries) {
      const c = counts2(s);
      failed = Math.max(failed, c.failed ?? 0);
      errors = Math.max(errors, c.errors ?? 0);
    }
    const last = summaries.length > 0 ? summaries[summaries.length - 1] : null;
    const tail = counts2(last ?? "");
    const failing = [...failedIds, ...errorIds].slice(0, MAX_FAILING6).map((id) => cap2(id, MAX_ENTRY));
    const summary = last ?? empty;
    return {
      runner: "pytest",
      passed: tail.passed ?? 0,
      failed,
      errors,
      skipped: tail.skipped ?? 0,
      failing,
      summary_line: summary === null ? null : cap2(summary, MAX_SUMMARY6)
    };
  }
};
var ruff = {
  name: "ruff",
  parse(text) {
    const violations = /* @__PURE__ */ new Set();
    let found = 0;
    let fixable = 0;
    let clean = false;
    let summary = null;
    let header = null;
    for (const raw of lines2(text)) {
      const line = raw.trim();
      const f = RUFF_FOUND.exec(line);
      if (f) {
        found = Math.max(found, Number(f[1]));
        summary = line;
        continue;
      }
      if (RUFF_CLEAN.test(line)) {
        clean = true;
        summary = line;
        continue;
      }
      const fix = RUFF_FIXABLE.exec(line);
      if (fix) {
        fixable = Math.max(fixable, Number(fix[1]));
        continue;
      }
      const concise = RUFF_CONCISE.exec(raw.trimStart());
      if (concise) {
        violations.add(`${concise[1]}:${concise[2]}:${concise[3]} ${concise[4]}`);
        continue;
      }
      const head = RUFF_HEADER.exec(line);
      if (head) {
        header = head[1] ?? null;
        continue;
      }
      const arrow = RUFF_ARROW.exec(raw);
      if (arrow && header !== null) {
        violations.add(`${arrow[1]}:${arrow[2]}:${arrow[3]} ${header}`);
        header = null;
      }
    }
    if (!clean && found === 0 && fixable === 0 && violations.size === 0) return null;
    const errors = Math.max(found, violations.size, fixable);
    return {
      runner: "ruff",
      passed: clean && errors === 0 ? 1 : 0,
      failed: 0,
      errors,
      skipped: 0,
      failing: [...violations].slice(0, MAX_FAILING6).map((v) => cap2(v, MAX_ENTRY)),
      summary_line: summary === null ? null : cap2(summary, MAX_SUMMARY6)
    };
  }
};
var parsers6 = [pytest, ruff];

// src/engine/runners/scenarios.ts
var PROVE_FILES = /^Files=(\d+), Tests=(\d+),/;
var PROVE_RESULT = /^Result: (PASS|FAIL|NOTESTS)\s*$/;
var PROVE_FILE = /^(\S+\.t) \.{2,}(?: (.*))?$/;
var PROVE_REPORT = /^(\S+\.t) \(Wstat: \d+ Tests: \d+ Failed: (\d+)\)/;
var PROVE_DIRECTIVE = /^\s*(?:not )?ok \d+\b.*# (?:skip|todo)\b/i;
var prove = {
  name: "prove",
  parse(text) {
    const lines3 = prepare2(text);
    let files = null;
    let result = null;
    let successful = false;
    let fileLines = 0;
    let skipped = 0;
    let failedSum = 0;
    let todo = 0;
    let dubious = false;
    const failing = /* @__PURE__ */ new Set();
    for (const line of lines3) {
      const f = PROVE_FILES.exec(line);
      if (f) {
        files = f;
        continue;
      }
      const r = PROVE_RESULT.exec(line);
      if (r) {
        result = r[1];
        continue;
      }
      const rep = PROVE_REPORT.exec(line);
      if (rep) {
        failing.add(rep[1]);
        failedSum += Number(rep[2]);
        continue;
      }
      const file = PROVE_FILE.exec(line);
      if (file) {
        fileLines++;
        if (/^skipped\b/.test(file[2] ?? "")) skipped++;
        continue;
      }
      if (PROVE_DIRECTIVE.test(line)) skipped++;
      else if (/^All tests successful\./.test(line)) successful = true;
      else if (/^Dubious, test returned/.test(line)) dubious = true;
      else if (/^\s+TODO passed:/.test(line)) todo++;
    }
    if (files === null && result === null && fileLines === 0) return null;
    const tests = Number(files?.[2] ?? 0);
    const failed = Math.max(failedSum, failing.size, result === "FAIL" || dubious ? 1 : 0);
    const complete = files !== null && (result !== null || successful) && result !== "NOTESTS" && tests > 0;
    const summary = files === null ? null : `Files=${files[1]}, Tests=${files[2]}${result === null ? "" : ` Result: ${result}`}`;
    return mk("prove", { passed: Math.max(tests - failed, 0), failed, skipped: skipped + todo }, failing, summary, !complete);
  }
};
var BEHAVE_SUMMARY = /^(\d+) (features?|scenarios?|steps?) passed, (\d+) failed(?:, (.*))?$/;
var BEHAVE_LIST = /^(?:Failing|Errored) scenarios:\s*$/;
var BEHAVE_LISTED = /^\s+(\S+\.feature:\d+)\s+(.*)$/;
var BEHAVE_ERROR_PARTS = /^(?:error|hook_error|cleanup_error)s?$/;
var behave = {
  name: "behave",
  parse(text) {
    const lines3 = prepare2(text);
    let passed = null;
    let passedFeatures = 0;
    let failed = 0;
    let errors = 0;
    let skipped = 0;
    let summary = null;
    let listing = false;
    let scenarioLines = 0;
    let assertLine = false;
    const failing = /* @__PURE__ */ new Set();
    for (const line of lines3) {
      const s = BEHAVE_SUMMARY.exec(line);
      if (s) {
        listing = false;
        const kind = s[2].replace(/s$/, "");
        failed = Math.max(failed, Number(s[3]));
        if (kind === "scenario") {
          passed = Math.max(passed ?? 0, Number(s[1]));
          summary = line;
        } else if (kind === "feature") passedFeatures = Math.max(passedFeatures, Number(s[1]));
        let errorsHere = 0;
        let skippedHere = 0;
        for (const part of (s[4] ?? "").split(", ")) {
          const m = /^(\d+) (\w+)$/.exec(part.trim());
          if (!m) continue;
          if (BEHAVE_ERROR_PARTS.test(m[2])) errorsHere += Number(m[1]);
          else skippedHere += Number(m[1]);
        }
        errors = Math.max(errors, errorsHere);
        skipped = Math.max(skipped, skippedHere);
        continue;
      }
      if (BEHAVE_LIST.test(line)) {
        listing = true;
        continue;
      }
      if (listing) {
        const l = BEHAVE_LISTED.exec(line);
        if (l) failing.add(`${l[1]} ${l[2]}`);
        else if (line.trim() !== "") listing = false;
        continue;
      }
      if (/^\s+Scenario(?: Outline)?: .*# \S+\.feature:\d+/.test(line)) scenarioLines++;
      else if (/^\s+ASSERT FAILED\b|^\s+Assertion Failed\b/.test(line)) assertLine = true;
    }
    if (summary === null && scenarioLines === 0 && failing.size === 0) return null;
    const failedAll = Math.max(failed, failing.size, summary === null && assertLine ? 1 : 0);
    const total = passed ?? passedFeatures;
    return mk("behave", { passed: total, failed: failedAll, errors, skipped }, failing, summary, summary === null || total === 0);
  }
};
var TOX4_ENV = /^\s*(\S+): (OK|SKIP|NOT AVAILABLE|FAIL code (-?\d+)|IGNORED FAIL code (-?\d+)) \(/;
var TOX_FINAL_OK = /^\s*congratulations :\)(?: \([\d.]+ seconds\))?\s*$/;
var TOX_FINAL_FAIL = /^\s*evaluation failed :\((?: \([\d.]+ seconds\))?\s*$/;
var TOX3_SEPARATOR = /^_{3,} summary _{3,}$/;
var TOX3_ENV = /^(ERROR:|SKIPPED:)?\s+(\S+): (.+)$/;
var tox = {
  name: "tox",
  parse(text) {
    const lines3 = prepare2(text);
    let ok = 0;
    let bad = 0;
    let skipped = 0;
    let envs = 0;
    let final = null;
    let finalFailed = false;
    let tox3 = false;
    const failing = /* @__PURE__ */ new Set();
    for (const line of lines3) {
      if (TOX3_SEPARATOR.test(line)) {
        tox3 = true;
        continue;
      }
      const e = TOX4_ENV.exec(line);
      if (e) {
        envs++;
        if (e[2] === "OK") ok++;
        else if (e[2] === "SKIP" || e[2] === "NOT AVAILABLE") skipped++;
        else {
          bad++;
          failing.add(e[1]);
        }
        continue;
      }
      if (TOX_FINAL_OK.test(line)) final = line;
      else if (TOX_FINAL_FAIL.test(line)) {
        final = line;
        finalFailed = true;
      } else if (tox3) {
        const t = TOX3_ENV.exec(line);
        if (!t) continue;
        envs++;
        const [, prefix, env, status] = t;
        if (prefix === void 0 && status === "commands succeeded") ok++;
        else if (prefix === "SKIPPED:" || prefix === void 0 && /^(?:skipped tests|InterpreterNotFound|platform mismatch)/.test(status)) skipped++;
        else {
          bad++;
          failing.add(env);
        }
      }
    }
    if (envs === 0 && final === null) return null;
    return mk("tox", { passed: ok, failed: Math.max(bad, finalFailed ? 1 : 0), skipped }, failing, final, final === null || ok + bad + skipped === 0);
  }
};
var parsers7 = [prove, behave, tox];

// src/engine/runners/suites.ts
var NX_SUMMARY = /^\s*Summary \[\s*[\d.]+s\] (?:(\d+)\/)?(\d+) tests? run: (.*)$/;
var NX_STATUS = /^\s*((?:TRY \d+ )?[A-Z][A-Z-]*(?: \d+\/\d+)?)\s+\[\s*[\d.]+s\]\s+(?:\(\s*\d+\/\d+\)\s+)?(\S.*)$/;
var NX_FAIL_LABEL = /^(?:FAIL|XFAIL|LEAK-FAIL|LKFAIL|TIMEOUT|TMT|ABORT|SEGV|SIG[A-Z0-9]+)$/;
var NX_CAVEAT_LABEL = /^(?:FLAKY|LEAK|TIMEOUT-PASS|TMPASS)\b/;
var NX_CANCEL = /^\s*(?:Cancelling due to|warning: \d+\/\d+ tests? were not run)/;
var NX_COMPILE = /^error(?:\[E\d+\])?: (?!could not compile|test run failed|command |no tests to run|aborting due to)/;
var NX_GENERATED = /^warning: `[^`]+`(?: \([^)]*\))? generated (\d+) warnings?/;
function nxCount(details, word) {
  const m = new RegExp(`(\\d+) ${word}\\b`).exec(details);
  return m ? Number(m[1]) : 0;
}
__name(nxCount, "nxCount");
var nextest = {
  name: "cargo nextest",
  parse(text) {
    const lines3 = prepare2(text);
    if (!lines3.some((l) => NEXTEST_MARK.test(l))) return null;
    const failing = /* @__PURE__ */ new Set();
    let best = null;
    let caveat = false;
    let cancelled = false;
    let compile3 = 0;
    let couldNot = false;
    let commandFailed = false;
    let runFailed = false;
    let noTests = false;
    let warnings = 0;
    for (const line of lines3) {
      const s = NX_SUMMARY.exec(line);
      if (s) {
        const details = s[3];
        const finished = Number(s[1] ?? s[2]);
        const initial = Number(s[2]);
        const failed2 = nxCount(details, "failed") + nxCount(details, "exec failed") + nxCount(details, "timed out");
        const candidate = {
          failed: failed2,
          passed: nxCount(details, "passed"),
          skipped: nxCount(details, "skipped"),
          incomplete: finished < initial || Number(s[2]) === 0 || nxCount(details, "flaky") + nxCount(details, "leaky") > 0 || /cancelled/.test(details),
          line
        };
        if (best === null || candidate.failed > best.failed) best = candidate;
        continue;
      }
      const st = NX_STATUS.exec(line);
      if (st) {
        const label = st[1];
        if (NX_FAIL_LABEL.test(label)) failing.add(st[2]);
        else if (NX_CAVEAT_LABEL.test(label) || label.startsWith("TRY ")) caveat = true;
        continue;
      }
      const g2 = NX_GENERATED.exec(line);
      if (g2) warnings += Number(g2[1]);
      else if (NX_CANCEL.test(line)) cancelled = true;
      else if (NX_COMPILE.test(line)) compile3++;
      else if (/^error: could not compile /.test(line)) couldNot = true;
      else if (/^error: command .* exited with code \d+/.test(line)) commandFailed = true;
      else if (/^error: test run failed\s*$/.test(line)) runFailed = true;
      else if (/^error: no tests to run\b/.test(line)) noTests = true;
    }
    const errors = Math.max(compile3, couldNot || commandFailed ? 1 : 0);
    const failed = Math.max(best?.failed ?? 0, failing.size, runFailed ? 1 : 0);
    const incomplete = best === null || best.incomplete || caveat || cancelled || noTests || errors === 0 && failed === 0 && best.passed === 0;
    return mk("cargo nextest", { passed: best?.passed ?? 0, failed, errors, skipped: best?.skipped ?? 0, warnings }, failing, best?.line ?? null, incomplete);
  }
};
var DART_PROGRESS = /^(?:\d+:)?\d{2}:\d{2} \+(\d+)(?: ~(\d+))?(?: -(\d+))?: (.*)$/;
var DART_FINAL = /^(?:All tests passed!|All tests skipped\.|Some tests failed\.|No tests ran\.)$/;
var dart = {
  name: "dart test",
  parse(text) {
    const lines3 = prepare2(text);
    let passed = 0;
    let skipped = 0;
    let failed = 0;
    let seen = false;
    let final = null;
    let finalLine = null;
    let listing = false;
    const failing = /* @__PURE__ */ new Set();
    for (const line of lines3) {
      const p = DART_PROGRESS.exec(line);
      if (p) {
        seen = true;
        listing = false;
        passed = Math.max(passed, Number(p[1]));
        skipped = Math.max(skipped, Number(p[2] ?? 0));
        failed = Math.max(failed, Number(p[3] ?? 0));
        if (DART_FINAL.test(p[4].trim())) {
          final = p[4].trim();
          finalLine = line;
        }
        continue;
      }
      if (/^No tests ran\.\s*$/.test(line)) {
        final ??= "No tests ran.";
        seen = seen || lines3.some((l) => /^No tests were found\.|^No tests match /.test(l));
        continue;
      }
      if (/^Failing tests:\s*$/.test(line)) listing = true;
      else if (listing && /^ {2}\S/.test(line)) failing.add(line.trim());
      else if (listing && line.trim() !== "") listing = false;
    }
    if (!seen) return null;
    const isFlutter = lines3.some((l) => /\bflutter test\b/.test(l));
    const failedAll = Math.max(failed, failing.size, final === "Some tests failed." ? 1 : 0);
    const incomplete = final === null || final === "No tests ran." || final === "All tests passed!" && passed === 0 || final === "All tests skipped.";
    return mk(isFlutter ? "flutter test" : "dart test", { passed, failed: failedAll, skipped }, failing, finalLine, incomplete);
  }
};
var JL_HEADER = /^Test Summary:\s*\|(.*)$/;
var JL_NAMED = /^(.+?): (?:Test Failed|Error During Test) at\b/;
var JL_UNNAMED = /^(?:Test Failed at\b|ERROR: LoadError: There was an error during testing)/;
var JL_VERDICT = /^\s*Testing (\S+) tests (passed|failed)\b/;
var JL_ROLLUP = /^ERROR: LoadError: Some tests did not pass: (\d+) passed, (\d+) failed, (\d+) errored, (\d+) broken\./;
function columns(header, from) {
  const cols = /* @__PURE__ */ new Map();
  for (const m of header.slice(from).matchAll(/\S+/g)) cols.set(m[0], from + (m.index ?? 0) + m[0].length);
  return new Map([...cols].map(([name, end]) => [end, name]));
}
__name(columns, "columns");
var julia = {
  name: "julia test",
  parse(text) {
    const lines3 = prepare2(text);
    const totals = { Pass: 0, Fail: 0, Error: 0, Broken: 0 };
    const failing = /* @__PURE__ */ new Set();
    let tables = 0;
    let verdict = null;
    let rollup = null;
    let pkgErrored = false;
    let unnamed = false;
    let started = false;
    let summary = null;
    for (let i = 0; i < lines3.length; i++) {
      const line = lines3[i];
      const h = JL_HEADER.exec(line);
      if (h) {
        tables++;
        const pipe = line.indexOf("|");
        const cols = columns(line, pipe + 1);
        let j = i + 1;
        for (; j < lines3.length; j++) {
          const row = lines3[j];
          if (row.charAt(pipe) !== "|" || JL_HEADER.test(row)) break;
          if (/^\s/.test(row)) continue;
          for (const m of row.slice(pipe + 1).matchAll(/\S+/g)) {
            const name = cols.get(pipe + 1 + (m.index ?? 0) + m[0].length);
            if (name !== void 0 && name in totals && /^\d+$/.test(m[0])) totals[name] = totals[name] + Number(m[0]);
          }
          summary ??= row;
        }
        i = j - 1;
        continue;
      }
      const n = JL_NAMED.exec(line);
      if (n) {
        failing.add(n[1]);
        continue;
      }
      if (JL_UNNAMED.test(line)) {
        unnamed = true;
        continue;
      }
      const v = JL_VERDICT.exec(line);
      if (v) {
        verdict = v[2];
        summary = line;
        continue;
      }
      const r = JL_ROLLUP.exec(line);
      if (r) rollup = r;
      else if (/^ERROR: Package \S+ errored during testing/.test(line)) pkgErrored = true;
      else if (/^\s+Testing (?:Running tests|\S+\s*$)/.test(line)) started = true;
    }
    if (tables === 0 && verdict === null && rollup === null && failing.size === 0 && !pkgErrored && !unnamed) return null;
    const failed = Math.max(totals["Fail"], Number(rollup?.[2] ?? 0), failing.size, unnamed ? 1 : 0, verdict === "failed" ? 1 : 0);
    const errors = Math.max(totals["Error"], Number(rollup?.[3] ?? 0), pkgErrored ? 1 : 0);
    const passed = totals["Pass"];
    const broken = totals["Broken"];
    const incomplete = tables === 0 || passed === 0 || started && verdict === null && failed + errors === 0;
    return mk("julia test", { passed, failed, errors, skipped: broken }, failing, summary, incomplete);
  }
};
var KAOCHA_SUMMARY = /^(\d+) tests?, (\d+) assertions?, (?:(\d+) errors?, )?(?:(\d+) pending, )?(\d+) failures?\.$/;
var KAOCHA_NAMED = /^(?:FAIL|ERROR) in (\S+) \(\S+:\d+\)\s*$/;
var KAOCHA_DOTS = /^\[[().FEP]+\]?$/;
var KAOCHA_WARN = /^WARNING: (?:No tests were found|All \d+ tests were skipped)/;
var kaocha = {
  name: "kaocha",
  parse(text) {
    const lines3 = prepare2(text);
    const failing = /* @__PURE__ */ new Set();
    let best = null;
    let dots = false;
    let warned = false;
    let dotsBad = 0;
    for (const line of lines3) {
      const s = KAOCHA_SUMMARY.exec(line);
      if (s) {
        const candidate = { tests: Number(s[1]), errors: Number(s[3] ?? 0), pending: Number(s[4] ?? 0), failed: Number(s[5]), line };
        if (best === null || candidate.failed + candidate.errors > best.failed + best.errors) best = candidate;
        continue;
      }
      const n = KAOCHA_NAMED.exec(line);
      if (n) {
        failing.add(n[1]);
        continue;
      }
      if (KAOCHA_DOTS.test(line)) {
        dots = true;
        dotsBad += (line.match(/[FE]/g) ?? []).length;
      } else if (KAOCHA_WARN.test(line)) warned = true;
    }
    if (best === null && !dots && !warned) return null;
    const errors = best?.errors ?? 0;
    const failed = Math.max(best?.failed ?? 0, failing.size - errors, dotsBad - errors);
    const pending = best?.pending ?? 0;
    const passed = best === null ? 0 : Math.max(best.tests - failed - errors - pending, 0);
    const incomplete = best === null || best.tests === 0 || warned;
    return mk("kaocha", { passed, failed, errors, skipped: pending }, failing, best?.line ?? null, incomplete);
  }
};
var parsers8 = [nextest, dart, julia, kaocha];

// src/engine/runners/index.ts
var PARSERS = [...parsers6, ...parsers3, ...parsers, ...parsers5, ...parsers4, ...parsers8, ...parsers7, ...parsers2];
function parseEvidence(text) {
  const runners = PARSERS.map((p) => p.parse(text)).filter((r) => r !== null);
  const exitMatches = [...text.matchAll(/^.{0,60}?\bexit (?:code|status)\s*[:=]?\s*(-?\d+)/gim)];
  const exit = exitMatches.map((m) => Number(m[1]));
  const exit_lines = exitMatches.slice(0, 3).map((m) => m[0].trim().slice(0, 80));
  const exit_code = exit.length === 0 ? null : exit.some((c) => c !== 0) ? exit.find((c) => c !== 0) : 0;
  const conflict = runners.some((r) => r.failed + r.errors > 0) && (runners.some((r) => r.failed + r.errors === 0 && r.passed > 0) || exit_code === 0);
  const trust = runners.length > 0 ? "parsed" : exit_code !== null ? "exit_code" : "unparsed";
  return { trust, exit_code, exit_lines, runners, conflict, lines: text.split("\n").length };
}
__name(parseEvidence, "parseEvidence");

// src/cli/commands/done.ts
var NEXT = {
  missing: "The evidence doesn't show the criterion. Run the check that proves it and pipe its output in; the same evidence gives the same answer.",
  unsure: "The evidence is ambiguous. Pipe the full output of the check that proves the criterion, or narrow the criterion."
};
function doneEvidence(text) {
  return clip(stripAnsi(text), 2e3, 12e3);
}
__name(doneEvidence, "doneEvidence");
var SKIPPED_NEXT = "Some tests were skipped, risky or incomplete, so done won't say met. Look at them: if they are expected (a platform-only test), say so yourself; otherwise run the skipped ones.";
var NO_TESTS = /\b(?:no tests? (?:to run|found|were found|executed|ran|collected|matched)|0 tests? (?:run|ran|executed|collected|found|completed)|tests? run: 0(?!\d)|nothing to run)/i;
var INCOMPLETE_NEXT = "The run is cut off, empty, cancelled, flaky or changed files, so done won't say met. Run the full check again and pipe all of its output in.";
var NO_TESTS_NEXT = "The log itself says no tests ran, so done won't say met. Run the tests that were meant to run and pipe their output in.";
var SKIP_WORDS = /^OK, but .*\b(?:incomplete|skipped|risky)\b/i;
function hasSkips(parsed) {
  return parsed.runners.some((r) => r.skipped > 0 || r.summary_line !== null && SKIP_WORDS.test(r.summary_line));
}
__name(hasSkips, "hasSkips");
function hasIncomplete(parsed) {
  return parsed.runners.some((r) => r.incomplete === true);
}
__name(hasIncomplete, "hasIncomplete");
function hasParsedWarnings(parsed) {
  return parsed.runners.some((r) => (r.warnings ?? 0) > 0);
}
__name(hasParsedWarnings, "hasParsedWarnings");
var UNPARSED_NEXT = `No recognised runner summary or exit code in the evidence, so it cannot count as met. Pipe the runner's full output, or add an exit code line: { your-command; echo "exit code: $?"; } 2>&1 | claude-referee done --criteria "..."`;
var CLEAN_CRITERION = /\b(?:lint\w*|clean|warning[- ]?free|no warnings?)\b/i;
var WARN_WORDS = /\b(?:warnings?|notices?|deprecat\w*)\b/i;
var WARN_NEGATED = /\b(?:0|no|zero|without) (?:warnings?|notices?)\b/gi;
var WARN_FLAG = /--?[\w-]*warn[\w-]*(?:[ =]\S+)?/gi;
var PROBLEM_WORDS = /\b(?:fail\w*|skipp\w*|partial\w*|errors?|violations?|findings?)\b/i;
var PROBLEM_NEGATED = /\b(?:0|no|zero|without) (?:errors?|findings?|violations?|failures?)\b/gi;
var SWALLOWED = /\|\|\s*true\b|--no-fail\b|--exit-zero\b/i;
var WARNING_NEXT = "The log shows a warning, notice, failure or skip wording, or a swallowed exit code, and only an exit code backs the lint criterion, so done won't say met. Pipe the linter's full summary, or say yourself that the warning is acceptable.";
function hasWarningMessage(evidence) {
  return WARN_WORDS.test(evidence.replace(WARN_FLAG, " ").replace(WARN_NEGATED, " "));
}
__name(hasWarningMessage, "hasWarningMessage");
function hasProblemMessage(evidence) {
  const log = evidence.replace(/(?:^|\n)[ \t]*\$[^\n]*/g, " ").replace(PROBLEM_NEGATED, " ");
  return PROBLEM_WORDS.test(log) || SWALLOWED.test(evidence);
}
__name(hasProblemMessage, "hasProblemMessage");
function factsOf(parsed) {
  return { trust: parsed.trust, exit_code: parsed.exit_code, exit_lines: parsed.exit_lines, runners: parsed.runners, conflict: parsed.conflict, lines: parsed.lines };
}
__name(factsOf, "factsOf");
function doneRequest(pack, thresholds, criteria, evidence) {
  const parsed = parseEvidence(evidence);
  if (parsed.exit_code !== null && parsed.exit_code !== 0) {
    const code = parsed.exit_code;
    return {
      planned: [],
      finish: /* @__PURE__ */ __name(() => ({
        ok: true,
        verdict: "missing",
        reason: "exit_code_nonzero",
        trust: parsed.trust,
        exit_code: code,
        p: 0,
        next_step: `The check exited with code ${code}, so nothing can be met and Jev was not asked. Fix the failure and run the check again.`
      }), "finish")
    };
  }
  const base2 = question(pack, "done.met");
  const questions = Object.fromEntries(criteria.map((criterion, i) => [`c${i + 1}`, { ...base2, instructions: withData(base2.instructions, { criterion }) }]));
  const met = threshold(pack, thresholds, "done.met", "met", 0.7);
  const missing = threshold(pack, thresholds, "done.met", "missing", 0.5);
  const finish = /* @__PURE__ */ __name(([outcome]) => {
    const warnCap = parsed.trust === "exit_code" && (hasWarningMessage(evidence) || hasProblemMessage(evidence)) || hasParsedWarnings(parsed);
    const per = criteria.map((criterion, i) => {
      const answer = outcome?.answers?.[`c${i + 1}`];
      const p = answer?.type === "noul" ? answer.noul : 0;
      const raw = p >= met ? "met" : p < missing ? "missing" : "unsure";
      const skipCap = raw === "met" && hasSkips(parsed);
      const noTestsCap = raw === "met" && NO_TESTS.test(evidence);
      const incompleteCap = raw === "met" && hasIncomplete(parsed);
      const warningCap = raw === "met" && warnCap && CLEAN_CRITERION.test(criterion);
      const verdict2 = raw === "met" && (parsed.trust === "unparsed" || parsed.conflict || skipCap || noTestsCap || incompleteCap || warningCap) ? "unsure" : raw;
      return { i: i + 1, verdict: verdict2, p, skipCap, noTestsCap, incompleteCap, warningCap };
    });
    const settled = per.every((c) => c.verdict !== "missing") && parsed.trust !== "unparsed" && !parsed.conflict;
    const noTestsCapped = settled && per.some((c) => c.noTestsCap);
    const skipCapped = settled && !noTestsCapped && per.some((c) => c.skipCap);
    const incompleteCapped = settled && !noTestsCapped && !skipCapped && per.some((c) => c.incompleteCap);
    const warningCapped = settled && !noTestsCapped && !skipCapped && !incompleteCapped && per.some((c) => c.warningCap);
    const verdict = per.some((c) => c.verdict === "missing") ? "missing" : per.some((c) => c.verdict === "unsure") ? "unsure" : "met";
    return {
      ok: true,
      verdict,
      p: Math.min(...per.map((c) => c.p)),
      trust: parsed.trust,
      ...parsed.exit_code !== null ? { exit_code: parsed.exit_code } : {},
      ...parsed.runners.length > 0 ? { runners: parsed.runners.map((r) => ({ runner: r.runner, passed: r.passed, failed: r.failed, errors: r.errors, skipped: r.skipped })) } : {},
      ...noTestsCapped && verdict === "unsure" ? { reason: "no_tests_run" } : skipCapped && verdict === "unsure" ? { reason: "skipped_tests" } : incompleteCapped && verdict === "unsure" ? { reason: "incomplete_run" } : warningCapped && verdict === "unsure" ? { reason: "warning_in_log" } : {},
      ...per.length > 1 ? { criteria: per.map(({ i, verdict: v, p: pp }) => ({ i, verdict: v, p: pp })) } : {},
      next_step: verdict === "met" ? void 0 : noTestsCapped && verdict === "unsure" ? NO_TESTS_NEXT : skipCapped && verdict === "unsure" ? SKIPPED_NEXT : incompleteCapped && verdict === "unsure" ? INCOMPLETE_NEXT : warningCapped && verdict === "unsure" ? WARNING_NEXT : parsed.trust === "unparsed" && per.every((c) => c.verdict !== "missing") ? UNPARSED_NEXT : NEXT[verdict]
    };
  }, "finish");
  const state = parsed.trust === "unparsed" ? { evidence } : { evidence: factsOf(parsed) };
  return { planned: [{ id: "done", state, questions }], finish };
}
__name(doneRequest, "doneRequest");
var done = {
  name: "done",
  describe: {
    summary: "Check whether piped test or lint output shows that each criterion holds.",
    inputs: {
      "--criteria <text>": 'What must hold, e.g. "all tests pass". Repeat for several; max 10.',
      "--evidence <file|->": "The check output. '-' or omitted reads stdin. ANSI colours are stripped; long output keeps its first 2,000 and last 12,000 characters. Output from a recognised test runner, linter or type checker, or with an exit code line, is parsed in code and only those facts are sent; anything else is sent as text and can never count as met."
    },
    outputs: {
      verdict: "met, unsure or missing; the lowest across criteria",
      trust: "parsed (a runner summary was recognised), exit_code (only an exit code line) or unparsed (met is not possible)",
      runners: "Parsed counts per recognised runner",
      reason: "exit_code_nonzero when the evidence has a non-zero exit code (missing, Jev not asked); skipped_tests, no_tests_run, incomplete_run or warning_in_log when met was capped at unsure because tests were skipped, risky or incomplete, the log says no tests ran, the parsed run is cut off, empty, cancelled, flaky or changed files, or a lint or clean criterion has a warning behind it (parsed, or in a log with only an exit code)",
      p: "Lowest probability that a criterion holds",
      criteria: "Per criterion, by position, when more than one",
      next_step: "Only when not met"
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: JEV_COST
  },
  options: { criteria: { type: "string", multiple: true }, evidence: { type: "string" } },
  async run(context) {
    const criteria = list(context, "criteria").map((c) => c.trim()).filter(Boolean);
    if (criteria.length === 0) throw new RefereeError("bad_input", "Give at least one --criteria.", { next_step: 'Example: --criteria "all tests pass"' });
    if (criteria.length > 10) throw new RefereeError("bad_input", "At most 10 criteria per call.");
    const evidence = doneEvidence(await readSource(context, str(context, "evidence"), "evidence"));
    if (!evidence.trim()) throw new RefereeError("bad_input", "The evidence is empty.");
    const { pack, project } = openPack(context);
    const { planned, finish } = doneRequest(pack, project?.thresholds, criteria, evidence);
    if (planned.length === 0 && !context.flags.dryRun) return { ...finish([]), requests: 0, cached: 0 };
    return jevCommand(context, "done", pack, planned, finish);
  }
};

// src/cli/commands/eval.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync4, readdirSync as readdirSync4, readFileSync as readFileSync8 } from "node:fs";
import { join as join8, resolve as resolve4, sep as sep2 } from "node:path";

// src/engine/stopgate/decide.ts
function question2(pack, id) {
  const q = pack.questions[id];
  if (!q) throw new Error(`pack has no question ${id}`);
  return q;
}
__name(question2, "question");
function decideStop(answers, pack, thresholds) {
  if (!answers) return null;
  const noul2 = /* @__PURE__ */ __name((id) => {
    const a = answers[id];
    return a?.type === "noul" && typeof a.noul === "number" ? a.noul : null;
  }, "noul");
  const claimsDone = noul2("claims_done");
  const claimsVerified = noul2("claims_verified");
  const applies = noul2("verification_applies");
  const outcome = answers["outcome"];
  if (claimsDone === null || claimsVerified === null || applies === null || outcome?.type !== "choice" || !outcome.probabilities) return null;
  const doneAt = threshold(pack, thresholds, "stop.gate", "claims_done", 0.7);
  const verifiedAt = thresholdBelow(pack, thresholds, "stop.gate", "claims_verified", 0.5);
  const appliesAt = threshold(pack, thresholds, "stop.gate", "verification_applies", 0.5);
  const blockedAt = thresholdBelow(pack, thresholds, "stop.gate", "blocked", 0.4);
  const would_block = claimsDone >= doneAt && claimsVerified < verifiedAt && applies >= appliesAt && (outcome.probabilities["blocked"] ?? 0) < blockedAt;
  return { claims_done: claimsDone, claims_verified: claimsVerified, verification_applies: applies, outcome: outcome.probabilities, would_block };
}
__name(decideStop, "decideStop");
function stopSkipReason(facts3) {
  if (facts3.edits.length === 0) return "no_edits";
  return facts3.passedCheckAfterLastEdit ? "check_passed_after_edit" : null;
}
__name(stopSkipReason, "stopSkipReason");
function stopQuestions(pack) {
  return {
    claims_done: question2(pack, "stop.claims_done"),
    claims_verified: question2(pack, "stop.claims_verified"),
    verification_applies: question2(pack, "stop.verification_applies"),
    outcome: question2(pack, "stop.outcome")
  };
}
__name(stopQuestions, "stopQuestions");
function stopState(facts3, finalMessage) {
  return { task: facts3.task, final_message: finalMessage, checks: facts3.checks.map((c) => ({ cmd: c.cmd, status: c.status })), edits: [...facts3.edits] };
}
__name(stopState, "stopState");

// src/engine/stopgate/transcript.ts
var TASK_MAX = 1500;
var FINAL_MAX = 2e3;
var CMD_MAX = 200;
var RESULT_TAIL = 2e5;
var EDIT_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
var SEPARATORS = /* @__PURE__ */ new Set(["&&", "||", "|", "|&", ";", "&", "\n", "(", ")"]);
var ASSIGNMENT2 = /^[A-Za-z_][A-Za-z0-9_]*=/;
var WRAPPERS = /* @__PURE__ */ new Set(["{", "time", "exec", "command", "env"]);
var SCRIPT = /^(test|lint|typecheck|check|build)(:.+)?$/;
var DIRECT_TOOLS = /* @__PURE__ */ new Set(["vitest", "jest", "tsc", "eslint", "playwright", "pytest", "ruff", "mypy", "phpunit", "pest", "rspec"]);
var FAILURE_MARKER = /\berror\b|\bfail(?:ed|ure|ures|ing)?\b|npm ERR!|✖|✗/i;
var USER_LINE = /"type"\s*:\s*"user"/;
var TOOL_RESULT_LINE = /"type"\s*:\s*"tool_result"/;
var TOOL_USE_ID = /"tool_use_id"\s*:\s*"([^"]*)"/g;
var SUBAGENT_TOOLS = /* @__PURE__ */ new Set(["Agent", "Task"]);
var TRUNCATED = [/^\s*<persisted-output>/, /\.\.\. \[\d+ (?:lines|characters) truncated\] \.\.\./, /^\s*Command did not complete within its \d+s timeout and was moved to the background/];
function withoutHeredocs(command) {
  const out = [];
  let delimiter = null;
  for (const line of command.split("\n")) {
    if (delimiter) {
      if ((delimiter.strip ? line.replace(/^\t+/, "") : line) === delimiter.word) delimiter = null;
      continue;
    }
    out.push(line);
    const match = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(line);
    if (match) delimiter = { word: match[3] ?? "", strip: match[1] === "-" };
  }
  return out.join("\n");
}
__name(withoutHeredocs, "withoutHeredocs");
function tokenize(command) {
  const tokens2 = [];
  let current = "";
  let quote = null;
  const flush = /* @__PURE__ */ __name(() => {
    if (current) tokens2.push(current);
    current = "";
  }, "flush");
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? "";
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < command.length) current += command[++i];
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    const two = command.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === "|&") {
      flush();
      tokens2.push(two);
      i++;
    } else if (ch === "|" || ch === ";" || ch === "&" || ch === "\n" || ch === "(" || ch === ")") {
      flush();
      tokens2.push(ch);
    } else if (ch === " " || ch === "	") {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
  return tokens2;
}
__name(tokenize, "tokenize");
var base = /* @__PURE__ */ __name((token) => token.slice(token.lastIndexOf("/") + 1), "base");
var skipFlags = /* @__PURE__ */ __name((args) => {
  let i = 0;
  while ((args[i] ?? "").startsWith("-")) i++;
  return args.slice(i);
}, "skipFlags");
function checkKind(segment) {
  let i = 0;
  while (i < segment.length && (ASSIGNMENT2.test(segment[i] ?? "") || WRAPPERS.has(segment[i] ?? ""))) i++;
  const first = segment[i];
  if (!first) return null;
  const name = base(first);
  const args = segment.slice(i + 1);
  const direct = /* @__PURE__ */ __name((tool, rest) => {
    if (tool === "tsc" || tool === "eslint") return { silent: true };
    if (tool === "ruff") return ["format", "version", "server", "config", "clean"].includes(rest[0] ?? "") ? null : { silent: true };
    return DIRECT_TOOLS.has(tool) ? { silent: false } : null;
  }, "direct");
  if (name === "npm" || name === "pnpm" || name === "yarn" || name === "bun") {
    const rest = skipFlags(args);
    const sub = rest[0] ?? "";
    if (sub === "exec" || sub === "dlx") {
      const tool = skipFlags(rest.slice(1))[0];
      return tool ? direct(base(tool), skipFlags(rest.slice(1)).slice(1)) : null;
    }
    if (sub === "run" || sub === "run-script") {
      const script = rest[1] ?? "";
      return SCRIPT.test(script) ? { silent: /^build(:.+)?$/.test(script) && name === "npm" } : null;
    }
    if (sub === "test") return { silent: false };
    if (name !== "npm" && SCRIPT.test(sub)) return { silent: false };
    return null;
  }
  if (name === "npx" || name === "bunx") {
    const rest = skipFlags(args);
    return rest[0] ? direct(base(rest[0]), rest.slice(1)) : null;
  }
  if (name === "python" || name === "python3") {
    if (args[0] === "-m" && ["pytest", "mypy", "ruff"].includes(args[1] ?? "")) return direct(args[1] ?? "", args.slice(2));
    return null;
  }
  if (name === "cargo") {
    const rest = args.filter((a) => !a.startsWith("+"));
    const sub = rest[0] ?? "";
    if (["test", "clippy", "build", "nextest"].includes(sub)) return { silent: false };
    return sub === "check" ? { silent: true } : null;
  }
  if (name === "go") {
    const sub = args[0] ?? "";
    if (sub === "test") return { silent: false };
    return sub === "vet" || sub === "build" ? { silent: true } : null;
  }
  if (name === "dotnet") return ["test", "build"].includes(args[0] ?? "") ? { silent: false } : null;
  if (name === "rake") return args[0] === "test" ? { silent: false } : null;
  if (name === "make") return args.some((a) => ["test", "check", "lint", "build"].includes(a)) ? { silent: false } : null;
  if (name === "mvn") return args.includes("test") ? { silent: false } : null;
  if (name === "gradle" || name === "gradlew") return args.some((a) => a === "test" || a === "check") ? { silent: false } : null;
  return direct(name, args);
}
__name(checkKind, "checkKind");
function analyzeCommand(command) {
  const tokens2 = tokenize(withoutHeredocs(command));
  let found = null;
  let segment = [];
  for (const token of [...tokens2, ";"]) {
    if (!SEPARATORS.has(token)) {
      segment.push(token);
      continue;
    }
    const kind = checkKind(segment);
    if (kind) found = found ? { silent: found.silent && kind.silent } : kind;
    segment = [];
  }
  if (!found) return null;
  const masked = tokens2.some((t) => t === "|" || t === "||" || t === "|&" || t === ";");
  return { silent: found.silent && !masked };
}
__name(analyzeCommand, "analyzeCommand");
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b) => b && b.type === "text" && typeof b.text === "string" ? b.text : "").filter(Boolean).join("\n");
}
__name(textOf, "textOf");
function parseLine(line) {
  try {
    const value = JSON.parse(line);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}
__name(parseLine, "parseLine");
function promptText(entry) {
  if (!entry || entry.type !== "user" || entry.isSidechain === true || entry.isMeta === true || entry.isCompactSummary === true) return null;
  const content = entry.message?.content;
  if (Array.isArray(content) && content.some((b) => b && b.type === "tool_result")) return null;
  const text = textOf(content);
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("<local-command-") || trimmed.startsWith("[Request interrupted")) return null;
  if (isNotification(entry, trimmed)) return null;
  return text;
}
__name(promptText, "promptText");
function isNotification(entry, trimmed) {
  return entry.origin?.kind === "task-notification" || trimmed.startsWith("<task-notification>");
}
__name(isNotification, "isNotification");
function notificationText(entry) {
  if (!entry || entry.type !== "user" || entry.isSidechain === true || entry.isMeta === true) return null;
  const text = textOf(entry.message?.content).trim();
  return text && isNotification(entry, text) ? text : null;
}
__name(notificationText, "notificationText");
function userPrompts(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!isPromptCandidate(line)) continue;
    const entry = parseLine(line);
    const found = promptText(entry);
    if (found !== null && typeof entry?.timestamp === "string") out.push({ ts: entry.timestamp, text: found });
  }
  return out;
}
__name(userPrompts, "userPrompts");
function isPromptCandidate(line) {
  return USER_LINE.test(line) && !TOOL_RESULT_LINE.test(line);
}
__name(isPromptCandidate, "isPromptCandidate");
function firstPrompt(text) {
  let pos = 0;
  while (pos < text.length) {
    let end = text.indexOf("\n", pos);
    if (end === -1) end = text.length;
    const line = text.slice(pos, end);
    if (isPromptCandidate(line)) {
      const found = promptText(parseLine(line));
      if (found !== null) return found;
    }
    pos = end + 1;
  }
  return "";
}
__name(firstPrompt, "firstPrompt");
function lastPromptEnd(text) {
  let end = text.length;
  while (end > 0) {
    const nl = text.lastIndexOf("\n", end - 1);
    const line = text.slice(nl + 1, end);
    if (isPromptCandidate(line)) {
      const found = promptText(parseLine(line));
      if (found !== null) return { start: end + 1, lineStart: nl + 1, prompt: found };
    }
    end = nl;
  }
  return { start: 0, lineStart: 0, prompt: null };
}
__name(lastPromptEnd, "lastPromptEnd");
function fullResultText(content) {
  return typeof content === "string" ? content : Array.isArray(content) ? content.map((b) => b && typeof b.text === "string" ? b.text : "").join("\n") : "";
}
__name(fullResultText, "fullResultText");
function isTruncated(text) {
  return TRUNCATED.some((re) => re.test(text));
}
__name(isTruncated, "isTruncated");
function statusOf(full, isError, silent) {
  const truncated = isTruncated(full);
  const status = rawStatus(full.length > RESULT_TAIL ? full.slice(-RESULT_TAIL) : full, isError, silent);
  return { status: truncated && status === "passed" ? "unknown" : status, truncated };
}
__name(statusOf, "statusOf");
function rawStatus(text, isError, silent) {
  const ev = parseEvidence(text);
  const bad = ev.runners.some((r) => r.failed + r.errors > 0);
  if (isError || bad || ev.exit_code !== null && ev.exit_code !== 0) return "failed";
  if (ev.trust === "parsed" && !ev.conflict) return "passed";
  if (ev.exit_code === 0) return "passed";
  if (silent && !FAILURE_MARKER.test(text)) return "passed";
  return "unknown";
}
__name(rawStatus, "rawStatus");
function scanTurn(text, from, to) {
  const out = { edits: [], calls: [], finalMessage: "", lastEdit: -1, subagentCalls: 0, subagentReports: 0 };
  const byId = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  let seq = 0;
  let pos = from;
  while (pos < to) {
    let end = text.indexOf("\n", pos);
    if (end === -1 || end > to) end = to;
    const line = text.slice(pos, end);
    pos = end + 1;
    if (!line.trim()) continue;
    if (TOOL_RESULT_LINE.test(line)) {
      let wanted = false;
      for (const m of line.matchAll(TOOL_USE_ID)) if (byId.has(m[1] ?? "")) wanted = true;
      if (!wanted) continue;
      const entry2 = parseLine(line);
      if (!entry2 || entry2.isSidechain === true || !Array.isArray(entry2.message?.content)) continue;
      for (const block of entry2.message.content) {
        const call = block && block.type === "tool_result" && typeof block.tool_use_id === "string" ? byId.get(block.tool_use_id) : void 0;
        if (!call) continue;
        const result = statusOf(fullResultText(block.content), block.is_error === true, call.silent);
        call.status = result.status;
        call.truncated = result.truncated;
      }
      continue;
    }
    if (line.includes("task-notification") && notificationText(parseLine(line)) !== null) {
      out.subagentReports++;
      continue;
    }
    if (!/"type"\s*:\s*"assistant"/.test(line)) continue;
    const entry = parseLine(line);
    if (!entry || entry.type !== "assistant" || entry.isSidechain === true || !Array.isArray(entry.message?.content)) continue;
    const message = textOf(entry.message.content).trim();
    if (message) out.finalMessage = message;
    for (const block of entry.message.content) {
      if (!block || block.type !== "tool_use" || typeof block.name !== "string") continue;
      const id = typeof block.id === "string" ? block.id : "";
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      if (EDIT_TOOLS.has(block.name)) {
        const path = block.name === "NotebookEdit" ? block.input?.notebook_path ?? block.input?.file_path : block.input?.file_path;
        if (typeof path === "string" && path) {
          if (!out.edits.includes(path)) out.edits.push(path);
          out.lastEdit = seq++;
        }
      } else if (SUBAGENT_TOOLS.has(block.name)) {
        out.subagentCalls++;
      } else if (block.name === "Bash" && typeof block.input?.command === "string") {
        const kind = analyzeCommand(block.input.command);
        if (!kind) continue;
        const call = { cmd: block.input.command.slice(0, CMD_MAX), silent: kind.silent, seq: seq++, status: "unknown", truncated: false };
        out.calls.push(call);
        if (id) byId.set(id, call);
      }
    }
  }
  return out;
}
__name(scanTurn, "scanTurn");
var passedAfterLastEdit = /* @__PURE__ */ __name((scan) => scan.calls.some((c) => c.seq > scan.lastEdit && c.status === "passed"), "passedAfterLastEdit");
function analyzeTranscript(text) {
  const empty = { task: "", finalMessage: "", edits: [], checks: [], passedCheckAfterLastEdit: false, marks: { truncatedChecks: 0, subagentCalls: 0, subagentReports: 0, stalePass: false } };
  try {
    if (typeof text !== "string" || !text) return empty;
    const task = firstPrompt(text).slice(0, TASK_MAX);
    const { start, lineStart } = lastPromptEnd(text);
    const turn = scanTurn(text, start, text.length);
    const passedCheckAfterLastEdit = turn.lastEdit >= 0 && passedAfterLastEdit(turn);
    let stalePass = false;
    if (turn.edits.length > 0 && !passedCheckAfterLastEdit && lineStart > 0) {
      const previous = lastPromptEnd(text.slice(0, lineStart));
      const before = scanTurn(text, previous.start, lineStart);
      stalePass = before.lastEdit >= 0 ? passedAfterLastEdit(before) : before.calls.some((c) => c.status === "passed");
    }
    const checks = turn.calls.map((c) => ({ cmd: c.cmd, status: c.status, ...c.truncated ? { truncated: true } : {} }));
    const marks = { truncatedChecks: turn.calls.filter((c) => c.truncated).length, subagentCalls: turn.subagentCalls, subagentReports: turn.subagentReports, stalePass };
    return { task, finalMessage: turn.finalMessage.slice(-FINAL_MAX), edits: turn.edits, checks, passedCheckAfterLastEdit, marks };
  } catch {
    return empty;
  }
}
__name(analyzeTranscript, "analyzeTranscript");

// src/engine/evals.ts
var MIN_PER_CLASS = 10;
function parseCases(text) {
  const seen = /* @__PURE__ */ new Set();
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line, i) => {
    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new RefereeError("bad_input", `Eval case line ${i + 1} is not valid JSON.`);
    }
    const { id, split, expected } = raw;
    if (typeof id !== "string" || !id) throw new RefereeError("bad_input", `Eval case line ${i + 1} needs an id.`);
    if (seen.has(id)) throw new RefereeError("bad_input", `Eval case id ${id} appears twice.`);
    if (split !== "dev" && split !== "holdout") throw new RefereeError("bad_input", `Eval case ${id} needs split "dev" or "holdout".`);
    if (typeof expected !== "string" || !expected) throw new RefereeError("bad_input", `Eval case ${id} needs an expected label.`);
    seen.add(id);
    return { ...raw, id, split, expected };
  });
}
__name(parseCases, "parseCases");
function parseRecordings(text) {
  return text.split(/\r?\n/).filter((line) => line.trim()).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}
__name(parseRecordings, "parseRecordings");
function findRecording(lines3, key) {
  const forCase = lines3.filter((l) => l.case === key.case && l.model === key.model);
  const match = [...forCase].reverse().find((l) => l.qhash === key.qhash && l.shash === key.shash);
  if (match) return { status: "ok", line: match };
  return { status: forCase.length > 0 ? "stale" : "missing" };
}
__name(findRecording, "findRecording");
var ratio = /* @__PURE__ */ __name((a, b) => b === 0 ? null : a / b, "ratio");
function metrics(items, positive) {
  const verdicts = positive === "yes" ? { yes: 0, review: 0, no: 0 } : positive === "block" ? { block: 0, allow: 0, skipped: 0, unsure: 0 } : { met: 0, unsure: 0, missing: 0 };
  const undecidedVerdict = positive === "yes" ? "review" : "unsure";
  for (const item of items) verdicts[item.verdict] = (verdicts[item.verdict] ?? 0) + 1;
  const predicted = items.filter((i) => i.verdict === positive);
  const actual = items.filter((i) => i.expected === positive);
  const truePositive = predicted.filter((i) => i.expected === positive).length;
  const decided = items.filter((i) => i.verdict !== undecidedVerdict).length;
  return {
    cases: items.length,
    verdicts,
    precision: ratio(truePositive, predicted.length),
    recall: ratio(truePositive, actual.length),
    automation: ratio(decided, items.length) ?? 0,
    wrong_positive: predicted.length - truePositive,
    wrong_negative: items.filter((i) => i.expected === positive && i.verdict !== positive && i.verdict !== undecidedVerdict).length
  };
}
__name(metrics, "metrics");
function parseSweep(spec) {
  const parts = spec.split(":").map(Number);
  const [from, to, step] = parts;
  if (parts.length !== 3 || from === void 0 || to === void 0 || step === void 0 || parts.some((n) => !Number.isFinite(n)) || step <= 0 || from > to) {
    throw new RefereeError("bad_input", "--sweep takes from:to:step, e.g. 0.50:0.95:0.05.");
  }
  const out = [];
  for (let t = from; t <= to + 1e-9; t += step) out.push(Number(t.toFixed(4)));
  return out;
}
__name(parseSweep, "parseSweep");
function sweep(items, positive, thresholds) {
  const rows = thresholds.map((t) => {
    const predicted = items.filter((i) => i.p >= t);
    const truePositive = predicted.filter((i) => i.expected === positive).length;
    return { t, precision: ratio(truePositive, predicted.length), recall: ratio(truePositive, items.filter((i) => i.expected === positive).length), wrong_positive: predicted.length - truePositive };
  });
  const positives = items.filter((i) => i.expected === positive).length;
  const negatives = items.length - positives;
  if (positives < MIN_PER_CLASS || negatives < MIN_PER_CLASS) {
    return { rows, suggested: null, reason: `No suggestion: fewer than ${MIN_PER_CLASS} cases in a class (${positives} positive, ${negatives} other).` };
  }
  const safe = rows.find((r) => r.wrong_positive === 0);
  return safe ? { rows, suggested: safe.t } : { rows, suggested: null, reason: "No threshold in the range avoids a wrong positive." };
}
__name(sweep, "sweep");

// src/cli/commands/judge.ts
var MAX_ITEMS = 500;
var LIST_LIMIT = 20;
function parseItems(text) {
  const trimmed = text.trim();
  const toItem = /* @__PURE__ */ __name((value, i) => {
    if (typeof value === "string") return value.trim() ? { id: String(i + 1), text: value } : null;
    const { id, text: body } = value ?? {};
    if (typeof body !== "string" || !body.trim()) return null;
    return { id: typeof id === "string" || typeof id === "number" ? String(id) : String(i + 1), text: body };
  }, "toItem");
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed).map(toItem).filter((x) => x !== null);
    } catch {
      throw new RefereeError("bad_input", "Items look like a JSON array but don't parse.");
    }
  }
  const lines3 = text.split(/\r?\n/);
  const jsonl = lines3.filter((l) => l.trim()).every((l) => l.trim().startsWith("{"));
  return lines3.map((line, i) => {
    if (!line.trim()) return null;
    if (!jsonl) return { id: String(i + 1), text: line };
    try {
      return toItem(JSON.parse(line), i);
    } catch {
      throw new RefereeError("bad_input", `Items line ${i + 1} is not valid JSON.`);
    }
  }).filter((x) => x !== null);
}
__name(parseItems, "parseItems");
function judgeRequest(pack, thresholds, id, text, shared) {
  const q = question(pack, id);
  if (q.type !== "noul") throw new RefereeError("bad_input", `judge needs yes/no questions; ${id} is a ${q.type}.`);
  const band = threshold(pack, thresholds, id, "auto", 0.9);
  const planned = [{ id: "item", state: { item: clip(text, 4e3, 4e3), ...shared ? { context: shared } : {} }, questions: { [id]: q } }];
  const finish = /* @__PURE__ */ __name(([outcome]) => {
    const answer = outcome?.answers?.[id];
    const p = answer?.type === "noul" ? answer.noul : 0.5;
    return { ok: true, verdict: atLeast(p, band) ? "yes" : atMost(p, 1 - band) ? "no" : "review", p };
  }, "finish");
  return { planned, finish };
}
__name(judgeRequest, "judgeRequest");
var judge = {
  name: "judge",
  describe: {
    summary: "Run a pack's yes/no questions over many items: lines, strings, failures.",
    inputs: {
      "--question <id[,id]>": "Pack question ids, e.g. line.risky or failure.env.",
      "--items <file|->": "A JSON array of strings or {id, text}, JSON lines, or plain lines (id = line number). Max 500 items.",
      "--context <text>": "Optional shared context for every item, e.g. the file name."
    },
    outputs: {
      verdict: "flagged when any answer is yes, review when some are unsure or unanswered, clear otherwise",
      items: "Number of items judged",
      yes: "Answers in the yes band",
      no: "Answers in the no band",
      review: "Answers between the bands",
      flagged: "Item ids with a yes (first 20; 'id/question' when several questions)",
      review_ids: "Item ids to review (first 20)",
      stopped: "Item ids not sent because they held something shaped like a credential",
      unanswered: "Item ids with no answer because of an API error or the 90-second deadline (first 20)"
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: `${JEV_COST} judge makes one request per item, six at a time.`
  },
  options: { question: { type: "string" }, items: { type: "string" }, context: { type: "string" } },
  async run(context) {
    const ids = (str(context, "question") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) throw new RefereeError("bad_input", "Give --question with one or more pack question ids.", { next_step: "The generic pack has line.risky and failure.env." });
    const items = parseItems(await readSource(context, str(context, "items"), "items"));
    if (items.length === 0) throw new RefereeError("bad_input", "No items to judge.");
    if (items.length > MAX_ITEMS) throw new RefereeError("too_large", `At most ${MAX_ITEMS} items per call.`, { next_step: "Split the items into several calls." });
    const { pack, project } = openPack(context);
    const questions = {};
    for (const id of ids) {
      const q = question(pack, id);
      if (q.type !== "noul") throw new RefereeError("bad_input", `judge needs yes/no questions; ${id} is a ${q.type}.`);
      questions[id] = q;
    }
    const shared = str(context, "context");
    const planned = items.map((item) => ({ id: item.id, state: { item: clip(item.text, 4e3, 4e3), ...shared ? { context: shared } : {} }, questions }));
    const auto = Object.fromEntries(ids.map((id) => [id, threshold(pack, project?.thresholds, id, "auto", 0.9)]));
    return jevCommand(
      context,
      "judge",
      pack,
      planned,
      (outcomes) => {
        let yes = 0;
        let no = 0;
        let review = 0;
        const flagged = [];
        const reviewIds = [];
        const stopped = [];
        const unanswered = [];
        for (const outcome of outcomes) {
          if (outcome.error) {
            unanswered.push(outcome.id);
            continue;
          }
          if (!outcome.answers) {
            stopped.push(outcome.id);
            continue;
          }
          for (const id of ids) {
            const answer = outcome.answers[id];
            const p = answer?.type === "noul" ? answer.noul : 0.5;
            const band = auto[id] ?? 0.9;
            const label = ids.length > 1 ? `${outcome.id}/${id}` : outcome.id;
            if (atLeast(p, band)) {
              yes += 1;
              flagged.push(label);
            } else if (atMost(p, 1 - band)) {
              no += 1;
            } else {
              review += 1;
              reviewIds.push(label);
            }
          }
        }
        const verdict = yes > 0 ? "flagged" : review > 0 || unanswered.length > 0 ? "review" : "clear";
        return {
          ok: true,
          verdict,
          items: items.length,
          yes,
          no,
          review,
          ...flagged.length ? { flagged: flagged.slice(0, LIST_LIMIT) } : {},
          ...reviewIds.length ? { review_ids: reviewIds.slice(0, LIST_LIMIT) } : {},
          ...stopped.length ? { stopped } : {},
          ...unanswered.length ? { unanswered: unanswered.slice(0, LIST_LIMIT), next_step: "Some items got no answer; run judge again on those items." } : {}
        };
      },
      { batch: true }
    );
  }
};

// src/engine/claims.ts
var DASHES = /[‐-―−]/g;
var CURLY_DOUBLE = /[“”„‟]/g;
var CURLY_SINGLE = /[‘’‚‛]/g;
var SPACES = /\s+/g;
var CORE = String.raw`(?:\d{4}-\d{2}-\d{2}(?!\d)|[vV]\d+(?:\.\d+)+(?!\d)|\d+(?:\.\d+){2,}(?!\d)|0[xX][0-9a-fA-F]+|(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d))`;
var NUMBER_SOURCE = String.raw`(?<![\p{L}\p{N}_.])[$€£]?${CORE}(?:%|[xX](?![\p{L}\p{N}_]))?`;
var DATE = /^\d{4}-\d{2}-\d{2}$/;
var VERSION3 = /^v?\d+(?:\.\d+){2,}$|^v\d/;
var ORDINAL = /^(?:st|nd|rd|th)(?![\p{L}])/iu;
var LETTER = new RegExp("^\\p{L}", "u");
var MAX_SMALL_INT = 10;
function baseNormalize(text) {
  return text.normalize("NFKC").replace(DASHES, "-").replace(CURLY_DOUBLE, '"').replace(CURLY_SINGLE, "'");
}
__name(baseNormalize, "baseNormalize");
function isWordChar(char) {
  return char !== void 0 && /[\p{L}\p{N}]/u.test(char);
}
__name(isWordChar, "isWordChar");
function stripEmphasis(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "*") continue;
    if (char === "_") {
      let end = i;
      while (text[end + 1] === "_") end++;
      const edge = !isWordChar(text[i - 1]) || !isWordChar(text[end + 1]);
      if (!edge) out += text.slice(i, end + 1);
      i = end;
      continue;
    }
    out += char;
  }
  return out;
}
__name(stripEmphasis, "stripEmphasis");
function normalizeForQuote(text) {
  return stripEmphasis(baseNormalize(text)).replace(SPACES, " ").trim().toLowerCase();
}
__name(normalizeForQuote, "normalizeForQuote");
function extractQuotes(claim) {
  const found = /* @__PURE__ */ new Set();
  let open = null;
  let start = 0;
  for (let i = 0; i < claim.length; i++) {
    const char = claim[i];
    if (open === null) {
      if (char === '"' || char === "“" || char === "„" || char === "‟" || char === "`") {
        open = char;
        start = i + 1;
      }
      continue;
    }
    const closes = open === "`" ? char === "`" : char === '"' || char === "”";
    if (!closes) continue;
    const text = claim.slice(start, i).trim();
    if (text.length >= 3) found.add(text);
    open = null;
  }
  return [...found];
}
__name(extractQuotes, "extractQuotes");
function numberKey(token) {
  let t = token.toLowerCase().replace(/^[$€£]/, "");
  if (/^0x/.test(t)) return t;
  t = t.replace(/[%x]$/, "");
  if (DATE.test(t)) return t;
  if (VERSION3.test(t)) return t.replace(/^v/, "");
  const [whole = "", frac = ""] = t.replace(/,/g, "").split(".");
  const intPart = whole.replace(/^0+(?=\d)/, "");
  const fracPart = frac.replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}
__name(numberKey, "numberKey");
function isIgnoredSmallInteger(token, after) {
  if (!/^\d+$/.test(token) || Number(token) > MAX_SMALL_INT) return false;
  return !LETTER.test(after) || ORDINAL.test(after);
}
__name(isIgnoredSmallInteger, "isIgnoredSmallInteger");
function extractNumbers(text) {
  const found = /* @__PURE__ */ new Set();
  for (const match of text.matchAll(new RegExp(NUMBER_SOURCE, "gu"))) {
    const token = match[0];
    const after = text.slice(match.index + token.length, match.index + token.length + 3);
    if (!isIgnoredSmallInteger(token, after)) found.add(token);
  }
  return [...found];
}
__name(extractNumbers, "extractNumbers");
function sourceNumberKeys(source) {
  const keys = /* @__PURE__ */ new Set();
  for (const match of source.matchAll(new RegExp(NUMBER_SOURCE, "gu"))) keys.add(numberKey(match[0]));
  return keys;
}
__name(sourceNumberKeys, "sourceNumberKeys");
function checkClaim(claim, source) {
  const quotes = extractQuotes(claim);
  const numbers = extractNumbers(baseNormalize(claim));
  let quotesMissing = [];
  if (quotes.length > 0) {
    const haystack = normalizeForQuote(source);
    quotesMissing = quotes.filter((quote) => !haystack.includes(normalizeForQuote(quote)));
  }
  let numbersMissing = [];
  if (numbers.length > 0) {
    const keys = sourceNumberKeys(baseNormalize(source));
    numbersMissing = numbers.filter((token) => !keys.has(numberKey(token)));
  }
  return { quotes, quotes_missing: quotesMissing, numbers, numbers_missing: numbersMissing };
}
__name(checkClaim, "checkClaim");

// src/cli/commands/verify.ts
var RELATIONS = ["supports", "contradicts", "says_nothing"];
function probabilities(answer) {
  const a = answer;
  return a?.type === "choice" && a.probabilities ? a.probabilities : null;
}
__name(probabilities, "probabilities");
function verifyRequest(pack, thresholds, claims2, source) {
  const relation = question(pack, "verify.relation");
  const injection = question(pack, "verify.injection");
  const baseCriteria = relation.criteria ?? {};
  const ordered = /* @__PURE__ */ __name((reverse) => Object.fromEntries(reverse ? Object.entries(baseCriteria).reverse() : Object.entries(baseCriteria)), "ordered");
  const state = { source };
  const stateTokens = estimateTokens(JSON.stringify(state));
  if (stateTokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", "The source is too large for one Jev request.", { next_step: "Pass the relevant section of the source." });
  const checks = new Map(claims2.map((c) => [c.id, checkClaim(c.text, source)]));
  const asked = claims2.filter((c) => {
    const k = checks.get(c.id);
    return k !== void 0 && k.quotes_missing.length === 0 && k.numbers_missing.length === 0;
  });
  const planned = [];
  let batch = {};
  let batchTokens = stateTokens;
  const flush = /* @__PURE__ */ __name(() => {
    if (Object.keys(batch).length) planned.push({ id: `part${planned.length + 1}`, state, questions: batch });
    batch = {};
    batchTokens = stateTokens;
  }, "flush");
  const add = /* @__PURE__ */ __name((key, q) => {
    const tokens2 = estimateTokens(JSON.stringify(q));
    if (stateTokens + tokens2 > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", `Claim ${key} is too long.`);
    if (batchTokens + tokens2 > REQUEST_TOKEN_LIMIT) flush();
    batch[key] = q;
    batchTokens += tokens2;
  }, "add");
  if (asked.length > 0) add("injection", injection);
  for (const claim of asked) {
    for (const [suffix, reverse] of [["a", false], ["b", true]]) {
      add(`claim:${claim.id}:${suffix}`, { ...relation, criteria: ordered(reverse), instructions: withData(relation.instructions, { claim: claim.text }) });
    }
  }
  flush();
  const supportsAt = threshold(pack, thresholds, "verify.relation", "supports", 0.8);
  const contradictsAt = threshold(pack, thresholds, "verify.relation", "contradicts", 0.5);
  const silentAt = threshold(pack, thresholds, "verify.relation", "says_nothing", 0.5);
  const flagAt = threshold(pack, thresholds, "verify.injection", "flag", 0.7);
  const finish = /* @__PURE__ */ __name((outcomes) => {
    const answers = Object.assign({}, ...outcomes.map((o) => o.answers ?? {}));
    const inj = answers["injection"];
    const injected = inj?.type === "noul" && typeof inj.noul === "number" && inj.noul >= flagAt;
    let supported = 0;
    const unsupported = [];
    const contradicted = [];
    const saysNothing = [];
    const unsure = [];
    const unanswered = [];
    const reasons = {};
    const listed = {};
    for (const claim of claims2) {
      const k = checks.get(claim.id);
      if (k && k.quotes_missing.length > 0) {
        const onlyCode = k.quotes_missing.every((q) => claim.text.includes(`\`${q}\``) && !claim.text.includes(`"${q}"`));
        (onlyCode ? unsure : unsupported).push(claim.id);
        reasons[claim.id] = onlyCode ? "identifier_not_in_source" : "quote_not_in_source";
        continue;
      }
      if (k && k.numbers_missing.length > 0) {
        unsure.push(claim.id);
        reasons[claim.id] = "number_not_in_source";
        continue;
      }
      const a = probabilities(answers[`claim:${claim.id}:a`]);
      const b = probabilities(answers[`claim:${claim.id}:b`]);
      if (!a || !b) {
        unanswered.push(claim.id);
        continue;
      }
      const mean = Object.fromEntries(RELATIONS.map((r) => [r, ((a[r] ?? 0) + (b[r] ?? 0)) / 2]));
      const lead = /* @__PURE__ */ __name((p) => RELATIONS.reduce((best, r) => (p[r] ?? 0) > (p[best] ?? 0) ? r : best, "supports"), "lead");
      const agree = lead(a) === lead(b);
      if (agree && mean.supports >= supportsAt) {
        if (injected) {
          unsure.push(claim.id);
          reasons[claim.id] = "source_has_instruction_for_judge";
          listed[claim.id] = mean.supports;
        } else supported += 1;
        continue;
      }
      listed[claim.id] = mean.supports;
      if (agree && mean.contradicts >= contradictsAt) {
        contradicted.push(claim.id);
        unsupported.push(claim.id);
        reasons[claim.id] = "contradicted";
      } else if (agree && mean.says_nothing >= silentAt) {
        saysNothing.push(claim.id);
        reasons[claim.id] = "says_nothing";
      } else {
        unsure.push(claim.id);
        reasons[claim.id] = agree ? "between_bands" : "orders_disagree";
      }
    }
    const notSupported = unsupported.length > 0;
    const verdict = notSupported ? "unsupported" : unsure.length || saysNothing.length || unanswered.length ? "unsure" : "supported";
    return {
      ok: true,
      verdict,
      claims: claims2.length,
      supported,
      ...unsupported.length ? { unsupported } : {},
      ...contradicted.length ? { contradicted } : {},
      ...saysNothing.length ? { says_nothing: saysNothing } : {},
      ...unsure.length ? { unsure } : {},
      ...unanswered.length ? { unanswered } : {},
      ...injected ? { source_injection: true } : {},
      ...Object.keys(reasons).length ? { reasons } : {},
      ...Object.keys(listed).length ? { p: listed } : {},
      next_step: verdict === "supported" ? void 0 : saysNothing.length && !notSupported && !unsure.length ? "The source is silent on the listed claims: add the passage that supports them, don't reword the claims." : "Fix or drop contradicted claims, add the source passage for silent ones, and check numbers that are not in the source with a script."
    };
  }, "finish");
  return { planned, finish };
}
__name(verifyRequest, "verifyRequest");
var MAX_CLAIMS = 100;
var claims = {
  name: "claims",
  describe: {
    summary: "Check claims against a source text.",
    inputs: {
      "--source <file|->": "The text the claims must be supported by. '-' reads stdin.",
      "--claim <text>": "A claim; repeat for several.",
      "--claims <file>": "Claims as a JSON array of strings or {id, text}, JSON lines, or plain lines. Max 100."
    },
    outputs: {
      verdict: "supported when every claim is, unsupported when any is contradicted or puts text in double quotes that isn't in the source, unsure otherwise (silent, a backticked name or a number not in the source, no answer)",
      claims: "Number of claims checked",
      supported: "Number of supported claims",
      unsupported: "Ids of contradicted claims and claims that quote text not in the source",
      contradicted: "Ids of claims the source contradicts",
      says_nothing: "Ids of claims the source is silent on: add the passage, don't reword",
      reasons: "Why each non-supported claim is listed, by id",
      source_injection: "True when the source has a line aimed at the judge; supported claims then become unsure",
      unsure: "Ids of claims between the bands",
      unanswered: "Ids of claims with no answer because of an API error or the 90-second deadline",
      p: "Probability of support for each unsupported or unsure claim, by id"
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: `${JEV_COST} verify asks all claims about one source in one request when they fit, two three-way questions per claim and one injection check; claims with a quote or number missing from the source are decided in code.`
  },
  options: { source: { type: "string" }, claim: { type: "string", multiple: true }, claims: { type: "string" } },
  async run(context) {
    const claimsFile = str(context, "claims");
    const inline = list(context, "claim");
    if (claimsFile && inline.length) throw new RefereeError("bad_input", "Use --claim or --claims, not both.");
    if (claimsFile === "-" && (str(context, "source") ?? "-") === "-") throw new RefereeError("bad_input", "Only one of --source and --claims can read stdin.");
    const claims2 = (claimsFile ? parseItems(await readSource(context, claimsFile, "claims")) : inline.map((text, i) => ({ id: String(i + 1), text }))).filter(
      (c) => c.text.trim()
    );
    if (claims2.length === 0) throw new RefereeError("bad_input", "Give at least one --claim or a --claims file.");
    if (claims2.length > MAX_CLAIMS) throw new RefereeError("too_large", `At most ${MAX_CLAIMS} claims per call.`);
    const source = stripAnsi(await readSource(context, str(context, "source"), "source"));
    const { pack, project } = openPack(context);
    const { planned, finish } = verifyRequest(pack, project?.thresholds, claims2, source);
    return jevCommand(context, "verify", pack, planned, finish, { partial: true });
  }
};
var verify = { ...claims, name: "verify", describe: { ...claims.describe, summary: "Alias of claims: check claims against a source text." } };

// src/cli/commands/eval.ts
var LIST_LIMIT2 = 20;
function readSuite(root, name) {
  const dir = join8(root, name);
  if (!existsSync4(join8(dir, "suite.json")) || !existsSync4(join8(dir, "cases.jsonl"))) {
    throw new RefereeError("bad_input", `No eval suite ${name}: it needs suite.json and cases.jsonl.`, { next_step: `Look in ${root}.` });
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync8(join8(dir, "suite.json"), "utf8"));
  } catch {
    throw new RefereeError("bad_input", `Suite ${name}: suite.json is not valid JSON.`);
  }
  if (typeof raw["command"] !== "string") throw new RefereeError("bad_input", `Suite ${name}: suite.json needs a command.`);
  const config = {
    command: raw["command"],
    ...typeof raw["criteria"] === "string" || Array.isArray(raw["criteria"]) ? { criteria: raw["criteria"] } : {},
    ...typeof raw["question"] === "string" ? { question: raw["question"] } : {},
    positive: typeof raw["positive"] === "string" ? raw["positive"] : "met",
    max_wrong_positive: typeof raw["max_wrong_positive"] === "number" ? raw["max_wrong_positive"] : 0,
    ...typeof raw["max_wrong_negative"] === "number" ? { max_wrong_negative: raw["max_wrong_negative"] } : {}
  };
  const recorded = join8(dir, "recorded.jsonl");
  return {
    name,
    dir,
    config,
    cases: parseCases(readFileSync8(join8(dir, "cases.jsonl"), "utf8")),
    recordings: existsSync4(recorded) ? parseRecordings(readFileSync8(recorded, "utf8")) : []
  };
}
__name(readSuite, "readSuite");
function suites(root, name) {
  if (name !== "all") return [readSuite(root, name)];
  if (!existsSync4(root)) return [];
  return readdirSync4(root, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync4(join8(root, d.name, "suite.json"))).map((d) => readSuite(root, d.name)).sort((a, b) => a.name.localeCompare(b.name));
}
__name(suites, "suites");
function criteriaFor(suite, item) {
  const own = item["criteria"] ?? item["criterion"] ?? suite.config.criteria;
  const list2 = (Array.isArray(own) ? own : [own]).filter((c) => typeof c === "string" && c.trim() !== "");
  if (list2.length === 0) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: no criterion.`);
  return list2;
}
__name(criteriaFor, "criteriaFor");
function stopRequest(pack, suite, item) {
  const name = typeof item["transcript"] === "string" ? item["transcript"] : "";
  const file = resolve4(suite.dir, name);
  if (!name || !file.startsWith(resolve4(suite.dir) + sep2) || !existsSync4(file)) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: the transcript file is missing or outside the suite.`);
  const facts3 = analyzeTranscript(readFileSync8(file, "utf8"));
  const skip = stopSkipReason(facts3);
  if (skip) return { planned: [], finish: /* @__PURE__ */ __name(() => ({ verdict: "skipped", reason: skip }), "finish") };
  const planned = [{ id: "stop", state: stopState(facts3, facts3.finalMessage), questions: stopQuestions(pack) }];
  return {
    planned,
    finish: /* @__PURE__ */ __name((outcomes) => {
      const decision = decideStop(outcomes[0]?.answers ?? null, pack, void 0);
      return decision ? { verdict: decision.would_block ? "block" : "allow", p: decision.claims_done } : { verdict: "unsure", p: Number.NaN };
    }, "finish")
  };
}
__name(stopRequest, "stopRequest");
function request(context, pack, suite, item) {
  const command = suite.config.command;
  if (command !== "done" && command !== "verify" && command !== "judge" && command !== "stop") throw new RefereeError("bad_input", `Suite ${suite.name} uses ${command}; eval handles done, verify, judge and stop suites for now.`);
  let planned;
  let finish;
  if (command === "stop") {
    ({ planned, finish } = stopRequest(pack, suite, item));
  } else if (command === "done") {
    const evidence = doneEvidence(typeof item["evidence"] === "string" ? item["evidence"] : "");
    if (!evidence.trim()) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: the evidence is empty.`);
    ({ planned, finish } = doneRequest(pack, void 0, criteriaFor(suite, item), evidence));
  } else if (command === "judge") {
    const text = typeof item["text"] === "string" ? item["text"] : "";
    if (!suite.config.question) throw new RefereeError("bad_input", `Suite ${suite.name}: a judge suite needs "question" in suite.json.`);
    if (!text.trim()) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: a judge case needs text.`);
    ({ planned, finish } = judgeRequest(pack, void 0, suite.config.question, text, typeof item["context"] === "string" ? item["context"] : void 0));
  } else {
    const claim = typeof item["claim"] === "string" ? item["claim"] : "";
    const source = typeof item["source"] === "string" ? item["source"] : "";
    if (!claim.trim() || !source.trim()) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: a verify case needs a claim and a source.`);
    ({ planned, finish } = verifyRequest(pack, void 0, [{ id: "1", text: claim }], source));
  }
  const first = planned[0];
  if (!first) return { suite, item, planned: null, finish, qhash: "code", shash: "code" };
  const redacted = redactRequest(first, context.io.home, pack.redact);
  return { suite, item, planned: { ...first, id: `${suite.name}/${item.id}` }, finish, qhash: questionHash(first.questions), shash: stateHash(redacted.body.state) };
}
__name(request, "request");
function cap3(context, flag) {
  const raw = str(context, flag);
  if (raw === void 0) return void 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || raw.trim() === "") throw new RefereeError("bad_input", `--${flag} takes a number of 0 or more.`);
  return value;
}
__name(cap3, "cap");
async function record(context, pack, list2) {
  const maxRequests = cap3(context, "max-requests");
  const maxUsd = cap3(context, "max-usd");
  const { io, flags } = context;
  const session = new Session({
    command: "eval",
    env: io.env,
    cwd: io.cwd,
    home: io.home,
    platform: io.platform,
    now: io.now,
    pack: { name: pack.name, version: `${pack.version}+${pack.hash}`, redact: pack.redact },
    dataDir: flags.dataDir,
    fresh: true
  });
  const todo = [];
  let skipped = 0;
  for (const suite of list2) {
    for (const item of suite.cases) {
      const req = request(context, pack, suite, item);
      if (req.planned === null) skipped += 1;
      else if (!flags.fresh && findRecording(suite.recordings, { case: item.id, qhash: req.qhash, shash: req.shash, model: session.model }).status === "ok") skipped += 1;
      else todo.push(req);
    }
  }
  const plans = todo.map((t) => t.planned);
  const tokens2 = plans.reduce((sum2, p) => sum2 + estimateTokens(JSON.stringify([p.state, p.questions])), 0);
  const usd = costUsd(session.model, tokens2);
  if (!flags.dryRun && maxRequests !== void 0 && plans.length > maxRequests) {
    throw new RefereeError("bad_input", `Recording would send ${plans.length} requests; --max-requests is ${maxRequests}. Nothing was sent.`, { next_step: "Record fewer cases (a smaller suite or --split) or raise the cap." });
  }
  if (!flags.dryRun && maxUsd !== void 0 && usd !== null && usd > maxUsd) {
    throw new RefereeError("bad_input", `Recording would cost about ${usd.toFixed(6)} USD (an estimate from about ${tokens2} input tokens); --max-usd is ${maxUsd}. Nothing was sent.`, { next_step: "Record fewer cases or raise the cap." });
  }
  if (flags.dryRun) return fitLine({ ...session.dryRun(plans), skipped });
  const outcomes = todo.length ? await session.run(plans, { partial: true }) : [];
  const failed = [];
  let recorded = 0;
  todo.forEach((req, i) => {
    const outcome = outcomes[i];
    if (!outcome?.answers) {
      failed.push(req.planned?.id ?? req.item.id);
      return;
    }
    const line = {
      suite: req.suite.name,
      case: req.item.id,
      split: req.item.split,
      model: session.model,
      pack: `${pack.name}@${pack.version}`,
      qhash: req.qhash,
      shash: req.shash,
      answers: outcome.answers,
      recorded_at: new Date(io.now()).toISOString()
    };
    appendFileSync2(join8(req.suite.dir, "recorded.jsonl"), JSON.stringify(line) + "\n");
    recorded += 1;
  });
  const receipt = session.record({ verdict: failed.length ? "partial" : "recorded" });
  return reorder({
    ok: true,
    verdict: failed.length ? "partial" : "recorded",
    suites: list2.map((s) => s.name),
    recorded,
    skipped,
    ...failed.length ? { failed: failed.slice(0, LIST_LIMIT2) } : {},
    ...session.stats(),
    next_step: failed.length ? "Run the same command again; recorded cases are skipped." : void 0,
    receipt: receipt.id
  });
}
__name(record, "record");
function scoreSuite(context, pack, suite, model, split, sweepSpec) {
  const items = suite.cases.filter((c) => !split || c.split === split).map((item) => {
    const req = request(context, pack, suite, item);
    if (req.planned === null) {
      const decided = req.finish([]);
      return { id: item.id, split: item.split, expected: item.expected, verdict: String(decided["verdict"]), p: Number.NaN };
    }
    const found = findRecording(suite.recordings, { case: item.id, qhash: req.qhash, shash: req.shash, model });
    if (found.status !== "ok") {
      const why = found.status === "missing" ? `no recording for ${model}` : "the question text or input changed since it was recorded";
      throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: ${why}.`, { next_step: `Run eval record --suite ${suite.name} with a key.` });
    }
    const result = req.finish([{ id: req.planned.id, answers: found.line.answers, stopped: [], cached: true }]);
    return { id: item.id, split: item.split, expected: item.expected, verdict: String(result["verdict"]), p: Number(result["p"]) };
  });
  const m = metrics(items, suite.config.positive);
  const swept = sweepSpec ? sweep(items, suite.config.positive, parseSweep(sweepSpec)) : null;
  return {
    suite: suite.name,
    verdict: m.wrong_positive > suite.config.max_wrong_positive || suite.config.max_wrong_negative !== void 0 && m.wrong_negative > suite.config.max_wrong_negative ? "violated" : "pass",
    ...m,
    max_wrong_positive: suite.config.max_wrong_positive,
    ...suite.config.max_wrong_negative !== void 0 ? { max_wrong_negative: suite.config.max_wrong_negative } : {},
    ...swept ? { sweep: swept.rows.map((r) => [r.t, r.precision, r.recall, r.wrong_positive]), suggested: swept.suggested, ...swept.reason ? { sweep_note: swept.reason } : {} } : {}
  };
}
__name(scoreSuite, "scoreSuite");
function score2(context, pack, list2, all) {
  const model = resolveModel(context.io.env);
  const split = str(context, "split");
  if (split !== void 0 && split !== "dev" && split !== "holdout") throw new RefereeError("bad_input", '--split takes "dev" or "holdout".');
  const scored = (all ? list2.filter((s) => s.recordings.length > 0) : list2).map((s) => scoreSuite(context, pack, s, model, split, str(context, "sweep")));
  const verdict = scored.some((s) => s["verdict"] === "violated") ? "violated" : "pass";
  if (!all && scored[0]) {
    const { suite, verdict: v, ...rest } = scored[0];
    return { ok: true, verdict: v, suite, model, ...split ? { split } : {}, ...rest };
  }
  return {
    ok: true,
    verdict,
    model,
    suites: scored.map((s) => ({ suite: s["suite"], verdict: s["verdict"], cases: s["cases"], wrong_positive: s["wrong_positive"], max_wrong_positive: s["max_wrong_positive"] }))
  };
}
__name(score2, "score");
var evalCommand = {
  name: "eval",
  describe: {
    summary: "Record Jev's answers for an eval suite once, then score them offline.",
    inputs: {
      "record | score": "Positional action.",
      "--suite <name|all>": "A directory under the evals dir with suite.json, cases.jsonl and, once recorded, recorded.jsonl. 'all' takes every suite; score then skips suites without recordings.",
      "--evals-dir <dir>": "Where the suites live; default jev-evals in the current directory. A suite.json names its command: done, verify or judge (a judge suite also names its question, and its cases have text and an expected yes, no or review).",
      "--split <dev|holdout>": "score: only cases from this split.",
      "--sweep <from:to:step>": "score: precision, recall and wrong positives per threshold; suggests one only with at least 10 cases per class.",
      "--fresh": "record: record every case again, even ones already recorded for this question text, input and model.",
      "--max-requests <n>": "record: stop before the first request when more than n cases are still to record.",
      "--max-usd <x>": "record: stop before the first request when the estimated input cost, from a token estimate, is above x USD."
    },
    outputs: {
      verdict: "record: recorded or partial; score: pass, or violated when wrong positives exceed the suite's max_wrong_positive or, when the suite sets max_wrong_negative, wrong negatives exceed that",
      recorded: "record: cases recorded now",
      skipped: "record: cases already recorded",
      verdicts: "score: count per verdict",
      precision: "score: share of positive verdicts that were right",
      recall: "score: share of expected positives found",
      automation: "score: share of cases with a definite verdict",
      wrong_positive: "score: positive verdicts that should not be; the kill criterion",
      wrong_negative: "score: expected positives that got a definite non-positive verdict (for a stop suite also a skip); enforced only when suite.json sets max_wrong_negative"
    },
    errors: [...JEV_ERRORS],
    effects: "record sends each unrecorded case to the TypeSafe API and appends to recorded.jsonl; score reads files only.",
    cost: "record: one Jev request per case not yet recorded. score: free and offline."
  },
  options: { suite: { type: "string" }, split: { type: "string" }, sweep: { type: "string" }, "evals-dir": { type: "string" }, "max-requests": { type: "string" }, "max-usd": { type: "string" } },
  async run(context) {
    const action = context.positionals[0];
    if (action !== "record" && action !== "score") throw new RefereeError("bad_input", "eval needs an action: record or score.", { next_step: "Example: eval score --suite injection" });
    const name = str(context, "suite");
    if (!name) throw new RefereeError("bad_input", "Give --suite <name|all>.");
    const root = resolve4(context.io.cwd, str(context, "evals-dir") ?? "jev-evals");
    const list2 = suites(root, name);
    const { pack } = openPack(context);
    return action === "record" ? record(context, pack, list2) : score2(context, pack, list2, name === "all");
  }
};

// src/cli/commands/lint-pack.ts
import { existsSync as existsSync5, readFileSync as readFileSync9, readdirSync as readdirSync5 } from "node:fs";
import { join as join9, resolve as resolve5 } from "node:path";

// src/engine/lint.ts
var OTHER = /^(?:other|none|neither|unknown|unsure|undecided|says_nothing|no_answer)$/i;
var COUNTING = /\b(?:how many|count (?:the|how)|counting|number of|sum of|total of|average|earlier than|later than|older than|newer than|days between)\b/i;
var COMPOUND = /\b(?:and|or|ve|veya)\b/i;
function lintQuestions(questions, model) {
  const out = [];
  const add = /* @__PURE__ */ __name((rule, severity, question3, message) => out.push({ rule, severity, question: question3, message }), "add");
  if (typeof model !== "string" || !model.trim() || /latest/i.test(model)) add("model", "warn", "(pack)", "pack.json should pin a model such as jev-1.13.0, not leave it open or use a latest alias.");
  for (const [id, q] of Object.entries(questions)) {
    const raw = q;
    const text = raw.instructions?.question;
    if (typeof text !== "string" || !text.trim()) {
      add("instructions", "error", id, "The question has no instructions.question text.");
      continue;
    }
    const type = raw.type;
    if (type === "noul") {
      if (COMPOUND.test(text)) add("compound", "warn", id, "The question contains and/or: split it so each Noul asks one thing.");
      const c = raw.criteria;
      if (typeof c?.true !== "string" || typeof c?.false !== "string") add("criteria", "error", id, "A Noul needs true and false criteria.");
      else if (c.true.trim() === c.false.trim() || c.true.includes(c.false) || c.false.includes(c.true)) add("contradiction", "warn", id, "The true and false criteria are the same or one contains the other; state what separates them.");
    }
    if (type === "choice" && raw.criteria && typeof raw.criteria === "object" && !Array.isArray(raw.criteria)) {
      const entries = Object.entries(raw.criteria);
      if (entries.length > 255) add("options", "error", id, "A Choice takes at most 255 options.");
      if (entries.length > 0) {
        if (!entries.some(([name]) => OTHER.test(name))) add("other", "warn", id, "A Choice should have an other or none option, so a model with no good fit has somewhere to go.");
        for (const [name, def] of entries) if (typeof def !== "string" || def.trim().length < 8 || def.trim() === name) add("definition", "warn", id, `Category ${name} has no definition in criteria; without one the model uses its own.`);
      }
    }
    if (type === "score") {
      const levels = raw.criteria;
      if (!Array.isArray(levels) || levels.length < 2 || levels.length > 10) add("levels", "error", id, "A Score needs 2 to 10 levels.");
      else if (levels.some((l) => typeof l !== "string" || !l.trim() || /^[\d.\s]+$/.test(l))) add("levels", "warn", id, "Every Score level needs a description, not only a number.");
    }
    if (COUNTING.test(text)) add("counting", "warn", id, "Counting, summing and date comparison belong in code, not in a question to Jev.");
  }
  return out;
}
__name(lintQuestions, "lintQuestions");
function lintRecorded(noulByKey, minCount = 10) {
  const out = [];
  for (const [key, values] of Object.entries(noulByKey)) {
    if (values.length < minCount) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    if (p10 >= 0.5) out.push({ rule: "recorded", severity: "warn", question: key, message: `The 10th percentile of ${values.length} recorded answers is ${p10.toFixed(2)}: this question scores high on every input and can't act as a gate.` });
  }
  return out;
}
__name(lintRecorded, "lintRecorded");

// src/cli/commands/lint-pack.ts
function readJson2(path) {
  try {
    return JSON.parse(readFileSync9(path, "utf8"));
  } catch {
    throw new RefereeError("bad_input", `Not valid JSON: ${path}`);
  }
}
__name(readJson2, "readJson");
function recordedNouls(root) {
  const out = {};
  if (!existsSync5(root)) throw new RefereeError("bad_input", `No evals directory: ${root}`);
  for (const entry of readdirSync5(root, { withFileTypes: true })) {
    const file = join9(root, entry.name, "recorded.jsonl");
    if (!entry.isDirectory() || !existsSync5(file)) continue;
    const latest = /* @__PURE__ */ new Map();
    for (const line of parseRecordings(readFileSync9(file, "utf8"))) latest.set(String(line.case), line.answers);
    for (const answers of latest.values()) {
      for (const [key, answer] of Object.entries(answers ?? {})) {
        const a = answer;
        if (a?.type === "noul" && typeof a.noul === "number") (out[`${entry.name}:${key.replace(/[0-9]+$/, "").replace(/^claim:.*$/, "claim")}`] ??= []).push(a.noul);
      }
    }
  }
  return out;
}
__name(recordedNouls, "recordedNouls");
var lintPack = {
  name: "lint-pack",
  describe: {
    summary: "Check a pack's questions against TypeSafe's question-writing rules.",
    inputs: {
      "<pack dir>": "A directory with pack.json and questions/*.json.",
      "--recorded <evals dir>": "Also flag a Noul whose recorded answers are high on every input (10th percentile at or above 0.5)."
    },
    outputs: {
      verdict: "clean, warnings or errors",
      findings: "Each with rule, severity, question and message",
      questions: "Number of questions checked"
    },
    errors: ["bad_input"],
    effects: "Reads files only; no network.",
    cost: "Free."
  },
  options: { recorded: { type: "string" } },
  async run(context) {
    const target = context.positionals[0];
    if (!target) throw new RefereeError("bad_input", "Give the pack directory.", { next_step: "Example: lint-pack plugins/claude-referee/packs/generic" });
    const dir = resolve5(context.io.cwd, target);
    if (!existsSync5(join9(dir, "pack.json"))) throw new RefereeError("bad_input", `No pack.json in ${dir}.`);
    const meta = readJson2(join9(dir, "pack.json"));
    const questions = {};
    const qdir = join9(dir, "questions");
    if (existsSync5(qdir)) for (const file of readdirSync5(qdir).filter((f) => f.endsWith(".json")).sort()) Object.assign(questions, readJson2(join9(qdir, file)));
    const findings = lintQuestions(questions, meta.model);
    const recorded = context.values["recorded"];
    if (typeof recorded === "string") findings.push(...lintRecorded(recordedNouls(resolve5(context.io.cwd, recorded))));
    const verdict = findings.some((f) => f.severity === "error") ? "errors" : findings.length ? "warnings" : "clean";
    return { ok: true, verdict, questions: Object.keys(questions).length, findings, next_step: verdict === "clean" ? void 0 : "Fix the findings; each message says what to change." };
  }
};

// src/cli/commands/receipts.ts
import { mkdirSync as mkdirSync6, writeFileSync as writeFileSync5 } from "node:fs";
import { dirname as dirname3, resolve as resolve6 } from "node:path";

// src/engine/stopgate/interval.ts
var MIN_LABELS_PER_CLASS = 10;
var PRECISION_TARGET = 0.8;
function logChoose(n, k) {
  let sum2 = 0;
  for (let i = 1; i <= k; i++) sum2 += Math.log((n - k + i) / i);
  return sum2;
}
__name(logChoose, "logChoose");
function pmf(n, k, p) {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}
__name(pmf, "pmf");
function cdf(n, x, p) {
  let sum2 = 0;
  for (let k = 0; k <= x; k++) sum2 += pmf(n, k, p);
  return Math.min(1, sum2);
}
__name(cdf, "cdf");
function bisect(f, target, increasing) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target === increasing) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
__name(bisect, "bisect");
function clopperPearson(x, n, confidence = 0.95) {
  if (!Number.isInteger(x) || !Number.isInteger(n) || n < 1 || x < 0 || x > n || !(confidence > 0 && confidence < 1)) throw new RangeError("clopperPearson needs integers 0 <= x <= n, n >= 1");
  const alpha = (1 - confidence) / 2;
  const lower = x === 0 ? 0 : bisect((p) => 1 - cdf(n, x - 1, p), alpha, true);
  const upper = x === n ? 1 : bisect((p) => cdf(n, x, p), alpha, false);
  return { lower, upper };
}
__name(clopperPearson, "clopperPearson");
var round = /* @__PURE__ */ __name((n) => Math.round(n * 1e3) / 1e3, "round");
var pair = /* @__PURE__ */ __name((x, n) => {
  const ci = clopperPearson(x, n);
  return [round(ci.lower), round(ci.upper)];
}, "pair");
function suggestThreshold(records, current) {
  const labelled = records.filter((r) => r.decision?.would_block === true && (r.label === "right" || r.label === "wrong"));
  const right = labelled.filter((r) => r.label === "right").length;
  const wrong = labelled.length - right;
  const base2 = { need: { right: MIN_LABELS_PER_CLASS, wrong: MIN_LABELS_PER_CLASS }, have: { right, wrong }, question: "stop.gate", key: "claims_done", current };
  if (right < MIN_LABELS_PER_CLASS || wrong < MIN_LABELS_PER_CLASS) return { ...base2, available: false, suggested: null, reason: "too_few_labels" };
  const overall = { precision: round(right / labelled.length), precision_ci95: pair(right, labelled.length), false_block_rate_ci95: pair(wrong, labelled.length) };
  const keptAt = /* @__PURE__ */ __name((t) => {
    const kept = labelled.filter((r) => (r.decision?.claims_done ?? 0) >= t);
    const k = kept.filter((r) => r.label === "right").length;
    return { n: kept.length, k };
  }, "keptAt");
  const meets = /* @__PURE__ */ __name((t) => {
    const { n, k } = keptAt(t);
    return n >= MIN_LABELS_PER_CLASS && clopperPearson(k, n).lower >= PRECISION_TARGET;
  }, "meets");
  const summary = /* @__PURE__ */ __name((t) => {
    const { n, k } = keptAt(t);
    return { labelled: n, right: k, precision: round(k / n), precision_ci95: pair(k, n) };
  }, "summary");
  if (meets(current)) return { ...base2, available: true, suggested: current, reason: "already_meets_target", kept: summary(current), overall };
  const candidates = [...new Set(labelled.map((r) => Math.floor((r.decision?.claims_done ?? 0) * 1e3) / 1e3))].filter((t) => t > current && t <= 1).sort((a, b) => a - b);
  for (const t of candidates) if (meets(t)) return { ...base2, available: true, suggested: t, reason: "raise_claims_done", kept: summary(t), overall };
  return { ...base2, available: true, suggested: null, reason: "no_threshold_reaches_target", overall };
}
__name(suggestThreshold, "suggestThreshold");

// src/engine/stopgate/stops.ts
import { appendFileSync as appendFileSync3, chmodSync, existsSync as existsSync6, mkdirSync as mkdirSync5, readFileSync as readFileSync10, renameSync, statSync as statSync4, writeFileSync as writeFileSync4 } from "node:fs";
import { join as join10 } from "node:path";
var RETENTION_MS = 90 * 864e5;
function stopsFile(dataDir) {
  return join10(dataDir, "stops.jsonl");
}
__name(stopsFile, "stopsFile");
function labelsFile(dataDir) {
  return join10(dataDir, "labels.jsonl");
}
__name(labelsFile, "labelsFile");
function parseLines(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string") out.push(value);
    } catch {
      continue;
    }
  }
  return out;
}
__name(parseLines, "parseLines");
function readLabels(dataDir) {
  const out = /* @__PURE__ */ new Map();
  try {
    const file = labelsFile(dataDir);
    if (!existsSync6(file)) return out;
    for (const line of readFileSync10(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const v = JSON.parse(line);
        if (v && typeof v.id === "string" && (v.label === "right" || v.label === "wrong") && typeof v.labelled_at === "string") out.set(v.id, v);
      } catch {
        continue;
      }
    }
  } catch {
    return out;
  }
  return out;
}
__name(readLabels, "readLabels");
function readStops(dataDir) {
  const file = stopsFile(dataDir);
  try {
    if (!existsSync6(file)) return [];
    const labels = readLabels(dataDir);
    return parseLines(readFileSync10(file, "utf8")).map((r) => {
      const l = labels.get(r.id);
      return l ? { ...r, label: l.label, labelled_at: l.labelled_at } : r;
    });
  } catch {
    return [];
  }
}
__name(readStops, "readStops");
function labelStop(dataDir, id, label, nowIso) {
  if (!readStops(dataDir).some((r) => r.id === id)) return false;
  try {
    appendFileSync3(labelsFile(dataDir), JSON.stringify({ id, label, labelled_at: nowIso }) + "\n", { mode: 384 });
  } catch {
    return false;
  }
  return true;
}
__name(labelStop, "labelStop");
function stopStats(records) {
  const skipped = {};
  for (const r of records) if (r.skipped) skipped[r.skipped] = (skipped[r.skipped] ?? 0) + 1;
  const asked = records.filter((r) => r.decision !== void 0);
  const blocks = asked.filter((r) => r.decision?.would_block === true);
  const labelledBlocks = blocks.filter((r) => r.label !== void 0);
  const right = labelledBlocks.filter((r) => r.label === "right").length;
  const wrong = labelledBlocks.filter((r) => r.label === "wrong").length;
  const times = asked.map((r) => r.ms).sort((a, b) => a - b);
  const errors = records.filter((r) => r.skipped === "jev_error" || r.skipped === "breaker_open").length;
  const allTimes = [...asked, ...records.filter((r) => r.skipped === "jev_error")].map((r) => r.ms).sort((a, b) => a - b);
  return {
    stops: records.length,
    skipped_by_reason: skipped,
    asked: asked.length,
    would_block: blocks.length,
    labelled: labelledBlocks.length,
    right,
    wrong,
    precision: labelledBlocks.length ? right / labelledBlocks.length : null,
    false_block_rate: labelledBlocks.length ? wrong / labelledBlocks.length : null,
    p95_ms: times.length ? times[Math.ceil(0.95 * times.length) - 1] ?? null : null,
    errors,
    error_rate: asked.length + errors ? errors / (asked.length + errors) : null,
    p95_all_ms: allTimes.length ? allTimes[Math.ceil(0.95 * allTimes.length) - 1] ?? null : null,
    unlabelled_would_block: blocks.length - labelledBlocks.length
  };
}
__name(stopStats, "stopStats");

// src/engine/stopgate/weak.ts
import { readFileSync as readFileSync11 } from "node:fs";
import { join as join11 } from "node:path";
var W = String.raw`(?<![\p{L}\p{N}])`;
var E = String.raw`(?![\p{L}\p{N}])`;
var compile2 = /* @__PURE__ */ __name((patterns) => patterns.map((p) => new RegExp(`${W}${p}${E}`, "iu")), "compile");
var SUBJECT = String.raw`(?:it|this|that|they|tests?|build|page|app|ci|everything|again|still|keeps?|just|now|is|are|was|were|got|goes)`;
var SELF_NEGATED = compile2([
  String.raw`(?:doesn'?t|does not|didn'?t|did not|isn'?t|is not|aren'?t|are not|wasn'?t|was not|won'?t|will not|still not|it'?s not)\s+(?:work|working|worked|fixed|pass|passing|passed|compile|compiling)`,
  String.raw`(?:doesn'?t|does not|didn'?t|did not|isn'?t|is not|won'?t)\s+(?:build|building|run|running)`,
  String.raw`(?:çalışmıyor|çalışmadı|olmadı|olmuyor|geçmiyor|aynı\s+hata|hata\s+(?:veriyor|alıyorum|çıkıyor)|(?:hâlâ|hala|yine)\s+(?:hata|aynı|olmuyor|olmadı|çalışmıyor))`
]);
var OUTCOME = compile2([
  String.raw`${SUBJECT}\s+(?:broken|broke|crash(?:es|ed|ing)?|failing|fails|failed|regressed)`,
  String.raw`(?:i\s+)?(?:got|get|getting|see|seeing|there'?s)\s+(?:an?\s+)?(?:error|exception|bug)`,
  String.raw`(?:it|this)\s+(?:throws|threw)\s+(?:an?\s+)?(?:error|exception)`,
  String.raw`same\s+(?:error|issue|problem|bug)`,
  String.raw`(?:bozuk|bozuldu|patlıyor|başarısız|hata\s+var)`
]);
var NEGATION = new RegExp(
  `${W}(?:no|not|nothing|never|without|none|neither|nor|anymore|longer|now|fixed|resolved|previously|earlier|before|yok|değil|değildi|artık|düzeldi|çözüldü|hatasız)${E}|n't`,
  "iu"
);
var HYPOTHETICAL = new RegExp(
  `${W}(?:if|whether|unless|when|should|would|could|might|ensure|until|eğer|ise|olursa|olsa)${E}|make sure|in case|^\\s*(?:please\\s+)?(?:fix|add|write|create|make|handle|implement|update|remove)${E}|\\bm[ıiuü]${E}`,
  "iu"
);
function reportsBreakage(text) {
  for (const sentence of text.match(/[^.!?;\n]+[.!?;\n]*/g) ?? []) {
    if (sentence.includes("?")) continue;
    for (const clause of sentence.split(/,|\s+(?:but|and|so|then)\s+/i)) {
      if (HYPOTHETICAL.test(clause)) continue;
      if (SELF_NEGATED.some((re) => re.test(clause))) return true;
      if (!NEGATION.test(clause) && OUTCOME.some((re) => re.test(clause))) return true;
    }
  }
  return false;
}
__name(reportsBreakage, "reportsBreakage");
var SCAN_CHARS = 1e3;
var MIN_TOKENS = 3;
var REASK_JACCARD = 0.6;
function tokens(text) {
  return new Set((text.slice(0, SCAN_CHARS).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length >= 3));
}
__name(tokens, "tokens");
function classifyNext(next, previous) {
  const head = next.slice(0, SCAN_CHARS);
  if (reportsBreakage(head)) return "reported_broken";
  const a = tokens(next);
  const b = tokens(previous);
  if (a.size < MIN_TOKENS || b.size < MIN_TOKENS) return null;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared) >= REASK_JACCARD ? "repeated_request" : null;
}
__name(classifyNext, "classifyNext");
function suggestFromTranscript(transcript, stopTs) {
  try {
    const prompts = userPrompts(transcript);
    const next = prompts.find((p) => p.ts > stopTs);
    if (!next) return null;
    const before = prompts.filter((p) => p.ts <= stopTs);
    const previous = before[before.length - 1]?.text ?? "";
    const reason = classifyNext(next.text, previous);
    return reason ? { label: "right", reason, source: "next_message" } : null;
  } catch {
    return null;
  }
}
__name(suggestFromTranscript, "suggestFromTranscript");
function suggestForStops(dirs, stops) {
  const out = /* @__PURE__ */ new Map();
  const cache = /* @__PURE__ */ new Map();
  const load = /* @__PURE__ */ __name((session) => {
    if (!/^[A-Za-z0-9._-]+$/.test(session)) return null;
    if (cache.has(session)) return cache.get(session) ?? null;
    let text = null;
    for (const dir of dirs) {
      try {
        text = readFileSync11(join11(dir, `${session}.jsonl`), "utf8");
        break;
      } catch {
        continue;
      }
    }
    cache.set(session, text);
    return text;
  }, "load");
  for (const stop of stops) {
    const text = load(stop.session_id);
    const found = text ? suggestFromTranscript(text, stop.ts) : null;
    if (found) out.set(stop.id, found);
  }
  return out;
}
__name(suggestForStops, "suggestForStops");

// src/engine/usage.ts
import { existsSync as existsSync7, readdirSync as readdirSync6, readFileSync as readFileSync12 } from "node:fs";
import { join as join12 } from "node:path";
var SEPARATORS2 = /* @__PURE__ */ new Set(["&&", "||", "|", "|&", ";", "&", "\n", "(", ")"]);
var ASSIGNMENT3 = /^[A-Za-z_][A-Za-z0-9_]*=/;
function withoutHeredocs2(command) {
  const out = [];
  let delimiter = null;
  for (const line of command.split("\n")) {
    if (delimiter) {
      if ((delimiter.strip ? line.replace(/^\t+/, "") : line) === delimiter.word) delimiter = null;
      continue;
    }
    out.push(line);
    const match = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(line);
    if (match) delimiter = { word: match[3] ?? "", strip: match[1] === "-" };
  }
  return out.join("\n");
}
__name(withoutHeredocs2, "withoutHeredocs");
function tokenize2(command) {
  const tokens2 = [];
  let current = "";
  let quote = null;
  const flush = /* @__PURE__ */ __name(() => {
    if (current) tokens2.push(current);
    current = "";
  }, "flush");
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? "";
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < command.length) current += command[++i];
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    const two = command.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === "|&") {
      flush();
      tokens2.push(two);
      i++;
    } else if (ch === "|" || ch === ";" || ch === "&" || ch === "\n" || ch === "(" || ch === ")") {
      flush();
      tokens2.push(ch);
    } else if (ch === " " || ch === "	") {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
  return tokens2;
}
__name(tokenize2, "tokenize");
function subcommand(token) {
  return token && /^[a-z][a-z-]*$/.test(token) ? token : "other";
}
__name(subcommand, "subcommand");
function callIn(segment) {
  let i = 0;
  while (i < segment.length && (ASSIGNMENT3.test(segment[i] ?? "") || ["{", "time", "exec", "command", "env"].includes(segment[i] ?? ""))) i++;
  const first = segment[i];
  if (first === "claude-referee") return subcommand(segment[i + 1]);
  if (first === "npx") {
    i++;
    while ((segment[i] ?? "").startsWith("-")) i += segment[i] === "--package" || segment[i] === "-p" ? 2 : 1;
    const name = segment[i] ?? "";
    return name === "claude-referee" || name.startsWith("claude-referee@") ? subcommand(segment[i + 1]) : null;
  }
  if (first === "node") {
    i++;
    while ((segment[i] ?? "").startsWith("-")) i++;
    const path = segment[i] ?? "";
    return path.endsWith("/dist/cli.mjs") && path.includes("claude-referee") ? subcommand(segment[i + 1]) : null;
  }
  return null;
}
__name(callIn, "callIn");
function cliCallsIn(command) {
  const calls = [];
  let segment = [];
  for (const token of [...tokenize2(withoutHeredocs2(command)), ";"]) {
    if (!SEPARATORS2.has(token)) {
      segment.push(token);
      continue;
    }
    const call = callIn(segment);
    if (call) calls.push(call);
    segment = [];
  }
  return calls;
}
__name(cliCallsIn, "cliCallsIn");
function transcriptFiles(dir) {
  if (!existsSync7(dir)) return [];
  const files = [];
  for (const entry of readdirSync6(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push({ path: join12(dir, entry.name), subagent: false });
    const sub = join12(dir, entry.name, "subagents");
    if (entry.isDirectory() && existsSync7(sub)) {
      for (const name of readdirSync6(sub).filter((n) => n.endsWith(".jsonl")).sort()) files.push({ path: join12(sub, name), subagent: true });
    }
  }
  return files;
}
__name(transcriptFiles, "transcriptFiles");
function resultChars(content) {
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return 0;
  return content.reduce((total, item) => total + (typeof item?.text === "string" ? item.text.length : 0), 0);
}
__name(resultChars, "resultChars");
function projectTranscriptDirs(env, home, cwd) {
  const configDir = env["CLAUDE_CONFIG_DIR"]?.trim() || join12(home, ".claude");
  return [.../* @__PURE__ */ new Set([cwd, projectRoot(cwd)])].map((p) => join12(configDir, "projects", p.replace(/[^A-Za-z0-9]/g, "-")));
}
__name(projectTranscriptDirs, "projectTranscriptDirs");
function scanUsage(dirs, since) {
  const files = [...new Map(dirs.flatMap(transcriptFiles).map((f) => [f.path, f])).values()];
  const calls = /* @__PURE__ */ new Map();
  const sizes = /* @__PURE__ */ new Map();
  for (const file of files) {
    for (const line of readFileSync12(file.path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const content = entry.message?.content;
      if (!Array.isArray(content)) continue;
      const ts = typeof entry.timestamp === "string" ? entry.timestamp : "";
      for (const item of content) {
        if (item.type === "tool_use" && item.name === "Bash" && typeof item.id === "string" && typeof item.input?.command === "string" && !calls.has(item.id)) {
          if (ts < since) continue;
          const commands2 = cliCallsIn(item.input.command);
          if (commands2.length) calls.set(item.id, { day: ts.slice(0, 10), commands: commands2, subagent: file.subagent });
        } else if (item.type === "tool_result" && typeof item.tool_use_id === "string" && !sizes.has(item.tool_use_id)) {
          sizes.set(item.tool_use_id, resultChars(item.content));
        }
      }
    }
  }
  const rows = /* @__PURE__ */ new Map();
  for (const [id, call] of calls) {
    call.commands.forEach((command, i) => {
      const key = `${call.day}|${command}`;
      const row = rows.get(key) ?? { calls: 0, subagent_calls: 0, result_chars: 0 };
      row.calls += 1;
      if (call.subagent) row.subagent_calls += 1;
      if (i === 0) row.result_chars += sizes.get(id) ?? 0;
      rows.set(key, row);
    });
  }
  return {
    transcripts: files.length,
    rows: [...rows.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, row]) => {
      const [day = "", command = ""] = key.split("|");
      return { day, command, ...row };
    })
  };
}
__name(scanUsage, "scanUsage");

// src/cli/commands/receipts.ts
function sum(receipts2, key) {
  return receipts2.reduce((total, r) => total + (r[key] ?? 0), 0);
}
__name(sum, "sum");
var receipts = {
  name: "receipts",
  describe: {
    summary: "Show totals from the local receipts, per day with --tokens, Claude-side calls with --usage, or export them.",
    inputs: {
      export: "Positional: write every receipt, all projects, to --out as JSON lines.",
      verify: "Positional: check the hash chain of every project's receipts (add --project-only for the current one). Receipts written before chaining existed are counted as unchained.",
      overrule: 'Positional: "overrule <id>" voids one decision: it is recorded in overruled.jsonl and the cached answers it used are deleted, so the next run asks again. The receipt itself is not rewritten.',
      "--out <file>": "Target file for export.",
      "--tokens": "Rows per day and command: runs, requests, cache hits, input tokens and the share of --fresh runs.",
      "--usage": "Claude-side: claude-referee CLI calls per day and command, counted from this project's Claude Code transcripts (subagents included, each tool call once), with the size of what each call returned. Nothing from the transcripts is printed.",
      "--stops": "List the Stop done-gate's shadow stops of this project, newest first, at most 20, with stats (precision and false block rate over labelled would_block stops, p95 ms, skips per reason). Excerpts only; nothing else from the store is printed.",
      "--unlabelled": "With --stops: only would_block stops without a label.",
      "--label <id>": "Mark one stop with --right (the block would have been correct) or --wrong (a false block).",
      "--right": "With --label: the would-be block was correct.",
      "--wrong": "With --label: the would-be block was a false block.",
      "--project-only": "With verify: only this project's chain.",
      "--all": "Every project instead of the current one.",
      "--days <n>": "How many days back to include; default 30, or 14 with --tokens or --usage. With --stops it limits the listed stops and their stats."
    },
    outputs: {
      verdict: "summary, tokens, usage, exported, stops, labelled, chain_ok, chain_broken or overruled",
      chain: "With verify: receipts, chained, unchained and breaks (project, id, kind mismatch, fork or unreadable)",
      dropped: "With overrule: how many cached answers were deleted",
      runs: "Command runs in the window",
      requests: "Jev requests made",
      cached: "Answers served from the cache or merged with an identical request",
      input_tokens: "Input tokens billed",
      cost_usd: "Estimated cost at list price",
      by_command: "Runs per command",
      rows: "With --tokens: one row per day and command. With --usage: day, command, calls, subagent_calls and result_chars",
      transcripts: "With --usage: how many transcript files were read",
      stats: "With --stops: stops, skipped_by_reason, asked, would_block, labelled, right, wrong, precision, false_block_rate, p95_ms (answered calls only), errors, error_rate (Jev errors and breaker skips over asked plus errors), p95_all_ms (answered and failed calls), unlabelled_would_block",
      stops: 'With --stops: id, ts, skipped, edits, checks, would_block, claims_done, claims_verified, task_excerpt, final_excerpt, label, and for an unlabelled would_block stop whose next prompt in the session transcript reports breakage or repeats the request, suggestion: {label: "right", reason: reported_broken or repeated_request, source: next_message}. It is a hint only: computed on read, never stored, never counted in stats or in the threshold suggestion, and the message text is never printed or kept',
      threshold_suggestion: "With --stops: only available (true) with at least 10 human labels of each class on would_block stops (have and need are always shown). Then claims_done is checked with exact Clopper-Pearson 95% intervals: suggested is the smallest value at or above the current one at which the kept labelled stops (at least 10) have a precision lower bound of 0.8 or more, or null if none does; it never suggests lowering the threshold. overall holds the precision and false block rate intervals. Nothing is written; set it in .claude/referee.json yourself",
      label: "With --label: the id and the label that was stored"
    },
    errors: ["bad_input"],
    effects: "Reads the data directory, and with --usage this project's Claude Code transcripts; export writes one file; --label appends to labels.jsonl.",
    cost: "Free."
  },
  options: {
    out: { type: "string" },
    tokens: { type: "boolean" },
    usage: { type: "boolean" },
    all: { type: "boolean" },
    "project-only": { type: "boolean" },
    days: { type: "string" },
    stops: { type: "boolean" },
    unlabelled: { type: "boolean" },
    label: { type: "string" },
    right: { type: "boolean" },
    wrong: { type: "boolean" }
  },
  async run(context) {
    const { io, flags, values, positionals } = context;
    const dataDir = resolveDataDir(io.env, io.home, io.cwd, flags.dataDir);
    if (positionals[0] === "export") {
      const out = str(context, "out");
      if (!out) throw new RefereeError("bad_input", "export needs --out <file>.");
      const all = readReceipts(dataDir);
      const path = resolve6(io.cwd, out);
      mkdirSync6(dirname3(path), { recursive: true });
      writeFileSync5(path, all.map((r) => JSON.stringify(r)).join("\n") + (all.length ? "\n" : ""));
      return { ok: true, verdict: "exported", receipts: all.length, out: tildify(path, io.home) };
    }
    if (positionals[0] === "verify") {
      const chain = verifyChain(dataDir, values["project-only"] === true ? projectId(io.cwd) : void 0);
      return { ok: true, verdict: chain.breaks.length === 0 ? "chain_ok" : "chain_broken", chain };
    }
    if (positionals[0] === "overrule") {
      const id = positionals[1];
      if (!id) throw new RefereeError("bad_input", "overrule needs a receipt id.", { next_step: "Run receipts overrule <id>." });
      const result = overruleReceipt(dataDir, id, new Date(io.now()).toISOString());
      if (!result) throw new RefereeError("bad_input", "No receipt with that id.");
      return { ok: true, verdict: "overruled", id, dropped: result.dropped };
    }
    if (positionals.length > 0) throw new RefereeError("bad_input", `Unknown receipts action: ${positionals[0]}`);
    const labelId = str(context, "label");
    if (labelId !== void 0) {
      const right = values["right"] === true;
      const wrong = values["wrong"] === true;
      if (right === wrong) throw new RefereeError("bad_input", "--label needs exactly one of --right or --wrong.", { next_step: "Run receipts --label <id> --right, or --wrong." });
      const label = right ? "right" : "wrong";
      if (!labelStop(dataDir, labelId, label, new Date(io.now()).toISOString())) {
        throw new RefereeError("bad_input", "No stop with that id.", { next_step: "Run receipts --stops to list the ids." });
      }
      return { ok: true, verdict: "labelled", id: labelId, label };
    }
    const tokens2 = values["tokens"] === true;
    const usage2 = values["usage"] === true;
    const days = Number(str(context, "days") ?? (tokens2 || usage2 ? 14 : 30));
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new RefereeError("bad_input", "--days must be a whole number from 1 to 366.");
    const since = new Date(io.now() - days * 864e5).toISOString();
    if (values["stops"] === true) {
      const project = projectId(io.cwd);
      const scopedStops = readStops(dataDir).filter((r) => r.project === project && r.ts >= since);
      const picked = (values["unlabelled"] === true ? scopedStops.filter((r) => r.decision?.would_block === true && !r.label) : scopedStops).sort((a, b) => a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0).slice(0, 20);
      const weak = suggestForStops(projectTranscriptDirs(io.env, io.home, io.cwd), picked.filter((r) => r.decision?.would_block === true && !r.label));
      const shown = picked.map((r) => ({
        id: r.id,
        ts: r.ts,
        skipped: r.skipped,
        edits: r.edits,
        checks: r.checks,
        would_block: r.decision?.would_block,
        claims_done: r.decision?.claims_done,
        claims_verified: r.decision?.claims_verified,
        task_excerpt: r.task_excerpt?.slice(0, 300),
        final_excerpt: r.final_excerpt?.slice(0, 300),
        label: r.label,
        ...r.label === void 0 && weak.has(r.id) ? { suggestion: weak.get(r.id) } : {}
      }));
      let current = 0.7;
      try {
        const project2 = loadProject(io.cwd);
        if (project2) current = threshold(loadPack(project2.pack, packDirs(io.env)), project2.thresholds, "stop.gate", "claims_done", 0.7);
      } catch {
      }
      return { ok: true, verdict: "stops", days, stats: stopStats(scopedStops), threshold_suggestion: suggestThreshold(scopedStops, current), stops: shown, receipt: `stops-${io.now().toString(36)}` };
    }
    if (usage2) {
      const { transcripts, rows } = scanUsage(projectTranscriptDirs(io.env, io.home, io.cwd), since);
      return { ok: true, verdict: "usage", days, project: projectId(io.cwd), transcripts, calls: rows.reduce((n, r) => n + r.calls, 0), rows };
    }
    const scoped = readReceipts(dataDir, values["all"] === true ? void 0 : projectId(io.cwd)).filter((r) => r.ts >= since);
    if (tokens2) {
      const groups = /* @__PURE__ */ new Map();
      for (const r of scoped) {
        const key = `${r.ts.slice(0, 10)}|${r.command}`;
        groups.set(key, [...groups.get(key) ?? [], r]);
      }
      const rows = [...groups.entries()].sort().map(([key, rs]) => {
        const [day, command] = key.split("|");
        return {
          day,
          command,
          runs: rs.length,
          requests: sum(rs, "requests"),
          cached: sum(rs, "cached"),
          input_tokens: sum(rs, "input_tokens"),
          fresh_share: rs.filter((r) => r.fresh).length / rs.length
        };
      });
      return { ok: true, verdict: "tokens", days, rows };
    }
    const byCommand = {};
    for (const r of scoped) byCommand[r.command] = (byCommand[r.command] ?? 0) + 1;
    return {
      ok: true,
      verdict: "summary",
      days,
      runs: scoped.length,
      requests: sum(scoped, "requests"),
      cached: sum(scoped, "cached"),
      input_tokens: sum(scoped, "input_tokens"),
      cost_usd: sum(scoped, "cost_usd"),
      by_command: byCommand
    };
  }
};

// src/cli/commands/index.ts
var commands = [done, decide, judge, claims, verify, receipts, doctor, evalCommand, lintPack];

// src/cli/io.ts
import { homedir } from "node:os";
async function readAll(stream) {
  if (stream.isTTY) return "";
  const chunks = [];
  for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}
__name(readAll, "readAll");
function processIo() {
  return {
    env: process.env,
    cwd: process.cwd(),
    home: homedir(),
    platform: process.platform,
    readStdin: /* @__PURE__ */ __name(() => readAll(process.stdin), "readStdin"),
    write: /* @__PURE__ */ __name((text) => void process.stdout.write(text), "write"),
    warn: /* @__PURE__ */ __name((text) => void process.stderr.write(text), "warn"),
    now: /* @__PURE__ */ __name(() => Date.now(), "now")
  };
}
__name(processIo, "processIo");

// src/cli/run.ts
import { join as join13 } from "node:path";
import { parseArgs } from "node:util";
var GLOBAL_OPTIONS = {
  describe: { type: "boolean" },
  pretty: { type: "boolean" },
  "dry-run": { type: "boolean" },
  fresh: { type: "boolean" },
  verbose: { type: "boolean" },
  "data-dir": { type: "string" },
  pack: { type: "string" },
  "fail-on": { type: "string" }
};
var SHARED_CONTRACT = {
  flags: {
    "--pretty": "Indented JSON for people.",
    "--data-dir <dir>": "Use another data directory for receipts, cache and results.",
    "--pack <name>": "Use this pack instead of the project's.",
    "--dry-run": "Commands that ask Jev: print the redacted request and a token estimate; send, cache and log nothing. Long requests are shortened; --pretty shows them in full.",
    "--fresh": "Commands that ask Jev: skip the answer cache.",
    "--fail-on <verdict,...>": "Exit with code 3 when the verdict is one of these, e.g. --fail-on missing,unsure."
  },
  exit_codes: {
    "0": "A verdict, including a negative one such as missing.",
    "1": "An error; the JSON line holds error, message and next_step.",
    "3": "The verdict is listed in --fail-on."
  }
};
function usage(commands2) {
  const width = Math.max(...commands2.map((c) => c.name.length), 4);
  const lines3 = commands2.map((c) => `  ${c.name.padEnd(width)}  ${c.describe.summary}`);
  return [
    `${KIT} ${VERSION}`,
    "",
    `Usage: ${KIT} <command> [options]`,
    "",
    "Commands:",
    ...lines3,
    "",
    "Every command accepts --describe (JSON contract), --pretty and --data-dir.",
    "Commands that ask Jev also accept --dry-run, --fresh and --fail-on <verdict,...>."
  ].join("\n");
}
__name(usage, "usage");
function flagsFrom(values) {
  const str2 = /* @__PURE__ */ __name((key) => typeof values[key] === "string" ? values[key] : void 0, "str");
  return {
    pretty: values["pretty"] === true,
    dryRun: values["dry-run"] === true,
    fresh: values["fresh"] === true,
    verbose: values["verbose"] === true,
    dataDir: str2("data-dir"),
    pack: str2("pack"),
    failOn: (str2("fail-on") ?? "").split(",").map((v) => v.trim()).filter(Boolean)
  };
}
__name(flagsFrom, "flagsFrom");
async function run(argv, io, commands2) {
  const [name, ...rest] = argv;
  if (name === void 0 || name === "help" || name === "--help" || name === "-h") {
    io.write(usage(commands2) + "\n");
    return 0;
  }
  if (name === "--version" || name === "-v") {
    io.write(`${VERSION}
`);
    return 0;
  }
  let pretty = rest.includes("--pretty");
  try {
    const command = commands2.find((c) => c.name === name);
    if (!command) {
      throw new RefereeError("bad_input", `Unknown command: ${name}`, { next_step: `Run ${KIT} --help for the list.` });
    }
    let parsed;
    try {
      parsed = parseArgs({ args: [...rest], options: { ...GLOBAL_OPTIONS, ...command.options }, allowPositionals: true, strict: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RefereeError("bad_input", message.slice(0, 300), { next_step: `Run ${KIT} ${name} --describe for the inputs.` });
    }
    const values = parsed.values;
    const flags = flagsFrom(values);
    pretty = flags.pretty;
    if (values["describe"] === true) {
      io.write(JSON.stringify({ command: command.name, ...command.describe, ...SHARED_CONTRACT }, null, pretty ? 2 : 0) + "\n");
      return 0;
    }
    const result = await command.run({ io, flags, values: parsed.values, positionals: parsed.positionals });
    const receipt = typeof result["receipt"] === "string" ? result["receipt"] : null;
    const detailsDir = flags.dryRun ? null : join13(resolveDataDir(io.env, io.home, io.cwd, flags.dataDir), "results");
    io.write(render(result, { pretty, detailsDir, receipt }) + "\n");
    const verdict = result["verdict"];
    return typeof verdict === "string" && flags.failOn.includes(verdict) ? 3 : 0;
  } catch (error) {
    const known = isRefereeError(error) ? error : new RefereeError("internal", error instanceof Error ? error.message : String(error));
    io.write(renderError(known, pretty) + "\n");
    return 1;
  }
}
__name(run, "run");

// src/cli/main.ts
installAbortGuard();
process.exitCode = await run(process.argv.slice(2), processIo(), commands);
