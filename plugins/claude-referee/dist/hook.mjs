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
  VERSION: () => VERSION,
  choice: () => choice,
  noul: () => noul,
  score: () => score
});
var requestIdFrom, APIPromise, ENV, readEnv, fromCodeOrEnv, range, DEFAULT_RETRY_POLICY, isRetryableStatus, parseRetryAfter, retryDelayMs, sleep, TypeSafeError, isRecord, extractMessage, describeValidationErrors, MAX_RAW_BODY_IN_MESSAGE, APIError, BadRequestError, AuthenticationError, PermissionDeniedError, NotFoundError, UnprocessableEntityError, RateLimitError, InternalServerError, APIConnectionError, APITimeoutError, APIUserAbortError, LOG_LEVELS, DEFAULT_LOG_LEVEL, isLogLevel, parseLogLevel, PREFIX, consoleLogger, RANK, drop, withLevel, KEY_HEADERS, OPAQUE_HEADERS, redactKey, redact, redactHeaders, noul, score, choice, validateQuestions, Models, unwrapModels, g, isBrowser, describeRuntime, VERSION, missingApiKey, missingFetch, refuseBrowser, defaultFetch, assertNonNegativeInteger, assertPositiveMs, assertNonNegativeMs, assertFraction, assertStatusSet, resolveRetryPolicy, isRetryableError, resolveLogLevel, stripTrailingSlashes, mergeHeaders, bufferResponse, RUNTIME, TypeSafeClient, parseBody;
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
        super((resolve2) => resolve2(void 0));
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
    sleep = /* @__PURE__ */ __name((ms, signal) => new Promise((resolve2, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const onAbort = /* @__PURE__ */ __name(() => {
        clearTimeout(timer);
        reject(signal?.reason);
      }, "onAbort");
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve2();
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
      for (const [name, question2] of Object.entries(questions)) {
        if (question2.type !== "score") continue;
        if (!Array.isArray(question2.criteria)) throw new TypeSafeError(`Score question "${name}" has criteria that are not a list; score criteria must be a list of descriptions indexed by score from zero.`);
        if (question2.criteria.length < 2) throw new TypeSafeError(`Score question "${name}" has ${question2.criteria.length} criteria; at least two scores are required.`);
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
    VERSION = "0.6.0";
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
      systemOne(request, options = {}) {
        validateQuestions(request.questions);
        const body = {
          ...request,
          model: request.model ?? this.defaultModel
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
          "User-Agent": `typesafe-sdk/${VERSION}`,
          "X-TypeSafe-SDK": `typesafe-sdk/${VERSION}`,
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

// src/hooks/main.ts
import { homedir } from "node:os";
import { dirname as dirname3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

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

// src/hooks/session-start.ts
import { appendFileSync as appendFileSync2 } from "node:fs";
import { join as join6 } from "node:path";

// src/engine/datadir.ts
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// src/engine/config.ts
var KIT = "claude-referee";
var DEFAULT_MODEL = "jev-1.13.0";
var MARKETPLACE = "claude-referee";
var USD_PER_MTOK = {
  "jev-1.13.0": 0.042
};
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

// src/engine/datadir.ts
function pluginDataId() {
  return `${KIT}@${MARKETPLACE}`.replace(/[^A-Za-z0-9_-]/g, "-");
}
__name(pluginDataId, "pluginDataId");
function resolveDataDir(env, home, cwd, flag) {
  if (flag) return resolve(cwd, flag);
  const fromEnv = env["CLAUDE_PLUGIN_DATA"]?.trim() || env["REFEREE_DATA_DIR"]?.trim();
  if (fromEnv) return fromEnv;
  const configDir = env["CLAUDE_CONFIG_DIR"]?.trim() || join(home, ".claude");
  return join(configDir, "plugins", "data", pluginDataId());
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
  return createHash("sha256").update(projectRoot(cwd)).digest("hex").slice(0, 12);
}
__name(projectId, "projectId");

// src/engine/pack.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync, readFileSync, readdirSync as readdirSync2 } from "node:fs";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

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
var NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
function bundledPackDirs() {
  const here = dirname(fileURLToPath(import.meta.url));
  return [join2(here, "packs"), join2(here, "..", "packs"), join2(here, "..", "..", "plugins", "claude-referee", "packs")];
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
  return existsSync(dir) ? readdirSync2(dir).filter((f) => f.endsWith(ext)).sort() : [];
}
__name(listFiles, "listFiles");
function hashDir(dir) {
  const hash = createHash2("sha256");
  const walk = /* @__PURE__ */ __name((d, rel) => {
    for (const entry of readdirSync2(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join2(d, entry.name);
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
    const candidate = join2(dir, name);
    if (existsSync(join2(candidate, "pack.json"))) return candidate;
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
  const meta = readJson(join2(dir, "pack.json"));
  const parent = typeof meta.extends === "string" ? loadPack(meta.extends, dirs, [...seen, name]) : null;
  const questions = { ...parent?.questions };
  for (const file of listFiles(join2(dir, "questions"), ".json")) Object.assign(questions, checkQuestions(readJson(join2(dir, "questions", file)), file));
  const thresholds = { ...parent?.thresholds, ...existsSync(join2(dir, "thresholds.json")) ? checkThresholds(readJson(join2(dir, "thresholds.json"))) : {} };
  const cheatsheet = { ...parent?.cheatsheet };
  for (const file of listFiles(join2(dir, "cheatsheet"), ".md")) cheatsheet[file.replace(/\.md$/, "")] = readFileSync(join2(dir, "cheatsheet", file), "utf8");
  const own = existsSync(join2(dir, "redact.json")) ? readJson(join2(dir, "redact.json")) : void 0;
  const redact3 = parent?.redact || own ? { stop: [...parent?.redact?.stop ?? [], ...own?.stop ?? []], replace: [...parent?.redact?.replace ?? [], ...own?.replace ?? []] } : void 0;
  const areas = existsSync(join2(dir, "areas.json")) ? readJson(join2(dir, "areas.json")) : parent?.areas;
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
function threshold(pack, project, question2, key, fallback) {
  const base2 = pack.thresholds[question2]?.[key] ?? fallback;
  const override = project?.[question2]?.[key];
  return typeof override === "number" && override > base2 ? Math.min(override, 1) : base2;
}
__name(threshold, "threshold");
function thresholdBelow(pack, project, question2, key, fallback) {
  const base2 = pack.thresholds[question2]?.[key] ?? fallback;
  const override = project?.[question2]?.[key];
  return typeof override === "number" && override < base2 ? Math.max(override, 0) : base2;
}
__name(thresholdBelow, "thresholdBelow");

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
      stopGate: gate === "shadow" || gate === "active" ? gate : "off",
      preModelSwitch: merged.hooks?.preModelSwitch === true
    },
    thresholds: typeof merged.thresholds === "object" && merged.thresholds !== null ? merged.thresholds : void 0
  };
}
__name(loadProject, "loadProject");
function areaFor(areas, root, cwd) {
  if (!areas?.length) return null;
  const rel = relative(root, cwd).split(sep).join("/");
  const path = rel === "" ? "" : `${rel}/`;
  const matches = areas.filter((a) => path.startsWith(a.prefix) || a.prefix === "" || a.prefix === "./");
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}
__name(areaFor, "areaFor");

// src/engine/receipts.ts
import { appendFileSync, existsSync as existsSync3, mkdirSync as mkdirSync2, readdirSync as readdirSync3, readFileSync as readFileSync4, rmSync } from "node:fs";
import { join as join5 } from "node:path";

// src/engine/cache.ts
import { createHash as createHash3 } from "node:crypto";
import { mkdirSync, readFileSync as readFileSync3, writeFileSync } from "node:fs";
import { join as join4 } from "node:path";
function sha256(text) {
  return createHash3("sha256").update(text).digest("hex");
}
__name(sha256, "sha256");
function cacheKey(parts) {
  return sha256(JSON.stringify([parts.pack, parts.packVersion, parts.model, parts.questions, parts.state]));
}
__name(cacheKey, "cacheKey");
function readCache(dataDir, key, now, ttlMs) {
  try {
    const entry = JSON.parse(readFileSync3(join4(dataDir, "cache", `${key}.json`), "utf8"));
    return now - entry.ts <= ttlMs ? entry : null;
  } catch {
    return null;
  }
}
__name(readCache, "readCache");
function writeCache(dataDir, key, entry) {
  try {
    const dir = join4(dataDir, "cache");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join4(dir, `${key}.json`), JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}
__name(writeCache, "writeCache");

// src/engine/receipts.ts
function newReceiptId(now, random = Math.random) {
  const tail = Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0");
  return `r${now.toString(36)}${tail}`;
}
__name(newReceiptId, "newReceiptId");
function receiptsDir(dataDir) {
  return join5(dataDir, "receipts");
}
__name(receiptsDir, "receiptsDir");
function chainLines(dataDir, project) {
  const dir = join5(receiptsDir(dataDir), project);
  if (!existsSync3(dir)) return [];
  return readdirSync3(dir).filter((f) => f.endsWith(".jsonl")).sort().flatMap((f) => readFileSync4(join5(dir, f), "utf8").split("\n")).filter((l) => l.trim());
}
__name(chainLines, "chainLines");
function appendReceipt(dataDir, receipt) {
  try {
    const dir = join5(receiptsDir(dataDir), receipt.project);
    mkdirSync2(dir, { recursive: true });
    const last = chainLines(dataDir, receipt.project).at(-1);
    const chained = last === void 0 ? receipt : { ...receipt, prev: sha256(last) };
    appendFileSync(join5(dir, `${receipt.ts.slice(0, 7)}.jsonl`), JSON.stringify(chained) + "\n");
    return true;
  } catch {
    return false;
  }
}
__name(appendReceipt, "appendReceipt");

// src/hooks/session-start.ts
var BRIEFING_LIMIT = 800;
function quote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
__name(quote, "quote");
function fit(text) {
  if (text.length <= BRIEFING_LIMIT) return text;
  const cut = text.slice(0, BRIEFING_LIMIT);
  return cut.slice(0, Math.max(cut.lastIndexOf("\n"), 0)) || cut;
}
__name(fit, "fit");
async function sessionStart(io2, pluginRoot2) {
  const started = io2.now();
  const { env } = io2;
  if (env["REFEREE_HOOKS"] === "off" || /^(?:false|0|no|off)$/i.test(env["CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED"]?.trim() ?? "")) return null;
  let input;
  try {
    input = JSON.parse(await io2.readStdin());
  } catch {
    return null;
  }
  if (typeof input?.cwd !== "string") return null;
  const cwd = input.cwd;
  const project = loadProject(cwd);
  if (!project?.hooks.sessionStart) return null;
  const dirs = packDirs(env);
  let pack = loadPack(project.pack, dirs);
  const area = areaFor(project.areas ?? pack.areas, project.root, cwd);
  if (area?.pack && area.pack !== pack.name) pack = loadPack(area.pack, dirs);
  const template = pack.cheatsheet["session"];
  if (!template) return null;
  const checks = area?.checks.length ? area.checks.join("; ") : "none listed in .claude/referee.json";
  const text = fit(
    template.replaceAll("{{pack}}", pack.name).replaceAll("{{cli}}", join6(pluginRoot2, "dist", "cli.mjs")).replaceAll("{{checks}}", checks).trim()
  );
  const dataDir = resolveDataDir(env, io2.home, cwd);
  const envFile = env["CLAUDE_ENV_FILE"];
  if (envFile) {
    const lines3 = [`export REFEREE_DATA_DIR=${quote(dataDir)}`, `export REFEREE_PACK=${quote(pack.name)}`];
    const packsDir = env["CLAUDE_PLUGIN_OPTION_PACKS_DIR"]?.trim();
    if (packsDir) lines3.push(`export REFEREE_PACKS_DIR=${quote(packsDir)}`);
    const model = env["CLAUDE_PLUGIN_OPTION_MODEL"]?.trim();
    if (model) lines3.push(`export REFEREE_MODEL=${quote(model)}`);
    try {
      appendFileSync2(envFile, lines3.join("\n") + "\n");
    } catch {
    }
  }
  appendReceipt(dataDir, {
    id: newReceiptId(started),
    ts: new Date(started).toISOString(),
    command: "session-start",
    project: projectId(cwd),
    pack: pack.name,
    requests: 0,
    cached: 0,
    input_tokens: 0,
    cost_usd: 0,
    chars: text.length,
    ms: Math.max(0, io2.now() - started),
    ...typeof input.session_id === "string" ? { session_id: input.session_id } : {}
  });
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } });
}
__name(sessionStart, "sessionStart");

// src/hooks/stop.ts
import { readFileSync as readFileSync7 } from "node:fs";

// src/engine/breaker.ts
import { mkdirSync as mkdirSync3, readFileSync as readFileSync5, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join7 } from "node:path";
var LIMIT = 3;
var STALE_MS = 24 * 60 * 60 * 1e3;
var BREAKER_CODES = /* @__PURE__ */ new Set(["timeout", "service_unavailable", "rate_limited"]);
function read(dataDir) {
  try {
    const state = JSON.parse(readFileSync5(join7(dataDir, "breaker.json"), "utf8"));
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
    mkdirSync3(dataDir, { recursive: true });
    writeFileSync2(join7(dataDir, "breaker.json"), JSON.stringify(state));
  } catch {
    return;
  }
}
__name(recordBreaker, "recordBreaker");

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

// src/engine/key.ts
import { execFile } from "node:child_process";
var runCommand = /* @__PURE__ */ __name((file, args, timeoutMs) => new Promise((resolve2) => {
  execFile(
    file,
    [...args],
    { timeout: timeoutMs, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 },
    (error, stdout) => resolve2(error ? null : stdout)
  );
}), "runCommand");
var processMemo = /* @__PURE__ */ new Map();
function splitCommand(command) {
  const out = [];
  let current = "";
  let quote2 = null;
  let started = false;
  for (const ch of command) {
    if (quote2) {
      if (ch === quote2) quote2 = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote2 = ch;
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
  if (quote2) throw new RefereeError("invalid_api_key", "TYPESAFE_API_KEY_CMD has an unclosed quote.");
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
    const estTokens = bodies.reduce((sum, b) => sum + estimateTokens(JSON.stringify(b)), 0);
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

// src/engine/stopgate/stops.ts
import { appendFileSync as appendFileSync3, chmodSync, existsSync as existsSync4, mkdirSync as mkdirSync4, readFileSync as readFileSync6, renameSync, statSync as statSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join8 } from "node:path";
var MAX_BYTES = 2e6;
var RETENTION_MS = 90 * 864e5;
function stopsFile(dataDir) {
  return join8(dataDir, "stops.jsonl");
}
__name(stopsFile, "stopsFile");
function newStopId(now, random = Math.random) {
  const tail = Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0");
  return `s${now.toString(36)}${tail}`;
}
__name(newStopId, "newStopId");
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
function writeAtomic(file, records) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync3(tmp, records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""), { mode: 384 });
  renameSync(tmp, file);
}
__name(writeAtomic, "writeAtomic");
function appendStop(dataDir, record) {
  try {
    mkdirSync4(dataDir, { recursive: true });
    const file = stopsFile(dataDir);
    appendFileSync3(file, JSON.stringify(record) + "\n", { mode: 384 });
    try {
      chmodSync(file, 384);
    } catch {
    }
    const size = statSync2(file).size;
    if (size > MAX_BYTES) {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
      const kept = parseLines(readFileSync6(file, "utf8")).filter((r) => r.ts >= cutoff);
      if (statSync2(file).size === size) writeAtomic(file, kept);
    }
  } catch {
    return;
  }
}
__name(appendStop, "appendStop");

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
    const compile2 = /* @__PURE__ */ new Set();
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
      if (CARGO_COMPILE.test(line)) compile2.add(line);
      else if (/^error: could not compile /.test(line)) couldNotCompile = true;
      else if (/^error: test failed, to rerun pass/.test(line)) testFailedLine = true;
    }
    const errors = compile2.size > 0 ? compile2.size : couldNotCompile ? 1 : 0;
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

// src/engine/runners/js.ts
var ANSI2 = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
var MAX_FAILING2 = 10;
var MAX_NAME2 = 120;
var MAX_SUMMARY2 = 200;
function toLines(text) {
  return text.replace(ANSI2, "").split(/\r\n|\r|\n/);
}
__name(toLines, "toLines");
function clip(line) {
  return line === null ? null : line.trim().slice(0, MAX_SUMMARY2);
}
__name(clip, "clip");
function listFailing(ids) {
  const out = [];
  for (const raw of ids) {
    const id = raw.trim().slice(0, MAX_NAME2);
    if (id !== "" && !out.includes(id)) out.push(id);
    if (out.length === MAX_FAILING2) break;
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
  return { runner, passed: f.passed, failed: f.failed, errors: f.errors, skipped: f.skipped, failing: listFailing(f.failing), summary_line: clip(f.summary) };
}
__name(facts2, "facts");
function parseJest(text) {
  const lines3 = toLines(text);
  const tests = tally(lines3, /^\s*Tests:\s+(?=.*\b\d+\s+(?:failed|passed|skipped|todo|total)\b)(\d.*)$/);
  const suites = tally(lines3, /^\s*Test Suites:\s+(\d.*)$/);
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
  if (tests.line === null && suites.line === null && noTests === null && ids.size === 0 && files.size === 0 && runErrors === 0) return null;
  const failed = Math.max(tests.failedMax, ids.size, ids.size === 0 && runErrors === 0 ? files.size : 0);
  const errors = Math.max(runErrors, failed === 0 ? suites.failedMax : 0);
  return facts2("jest", {
    passed: tests.last.passed,
    failed,
    errors,
    skipped: tests.last.skipped,
    failing: ids.size > 0 ? ids : files,
    summary: tests.line ?? suites.line ?? noTests
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
var parsers2 = [
  { name: "jest", parse: parseJest },
  { name: "vitest", parse: parseVitest },
  { name: "mocha", parse: parseMocha },
  { name: "eslint", parse: parseEslint },
  { name: "tsc", parse: parseTsc },
  { name: "node:test", parse: parseNodeTest }
];

// src/engine/runners/more.ts
var ANSI3 = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;
var MAX_FAILING3 = 10;
var MAX_NAME3 = 120;
var MAX_SUMMARY3 = 200;
var prepare2 = /* @__PURE__ */ __name((text) => text.replace(ANSI3, "").split(/\r?\n/), "prepare");
var clip2 = /* @__PURE__ */ __name((value, max) => value.trim().slice(0, max), "clip");
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
    const lines3 = prepare2(text);
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
        names.add(clip2(named[2], MAX_NAME3));
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
          line: clip2(lines3[j], MAX_SUMMARY3)
        };
        if (r[1] === "FAILED" && summary.failed + summary.errors === 0) summary.failed = 1;
        if (best === null || summary.failed + summary.errors > best.failed + best.errors) best = summary;
        break;
      }
    }
    if (best === null && verbose === 0) return null;
    if (best === null) {
      return { runner: "unittest", passed: ok, failed: Math.max(verboseFail, 0), errors: verboseError, skipped: verboseSkip, failing: [...names].slice(0, MAX_FAILING3), summary_line: null };
    }
    const passed = Math.max(best.ran - best.failed - best.errors - best.skipped, 0);
    return { runner: "unittest", passed, failed: best.failed, errors: best.errors, skipped: best.skipped, failing: [...names].slice(0, MAX_FAILING3), summary_line: best.line };
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
    const lines3 = prepare2(text);
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
        summary = clip2(line, MAX_SUMMARY3);
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
        summary = clip2(line, MAX_SUMMARY3);
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
    const lines3 = prepare2(text);
    if (!lines3.some((l) => GOLANGCI_MARK.test(l))) return null;
    let after = 0;
    let counted = 0;
    let issues = 0;
    let summary = null;
    for (const line of lines3) {
      const a = GOLANGCI_AFTER.exec(line);
      if (a) {
        after = Math.max(after, Number(a[1]));
        summary ??= clip2(line, MAX_SUMMARY3);
        continue;
      }
      const c = GOLANGCI_COUNT.exec(line);
      if (c) {
        counted = Math.max(counted, Number(c[1]));
        summary = clip2(line, MAX_SUMMARY3);
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
    const lines3 = prepare2(text);
    if (!lines3.some((l) => VITE_MARK.test(l))) return null;
    let errors = 0;
    let warnings = 0;
    let built = null;
    for (const line of lines3) {
      if (VITE_BUILT.test(line)) built = clip2(line, MAX_SUMMARY3);
      else if (VITE_ERROR.test(line)) errors++;
      else if (VITE_WARN.test(line)) warnings++;
    }
    return { runner: "vite", passed: 0, failed: 0, errors, skipped: 0, warnings, failing: [], summary_line: errors > 0 ? null : built };
  }
};
var CARGO_BUILD_CMD = /\bcargo (?:build|check)\b/;
var CARGO_PROGRESS = /^\s+(?:Compiling|Checking) \S+ v\d/;
var CARGO_FINISHED = /^\s+Finished `?\w+`? (?:profile|\[)/;
var cargoBuild = {
  name: "cargo build",
  parse(text) {
    const lines3 = prepare2(text);
    if (lines3.some((l) => CLIPPY_MARK.test(l))) return null;
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
        summary = clip2(line, MAX_SUMMARY3);
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
        summary = clip2(line, MAX_SUMMARY3);
        continue;
      }
      if (CLIPPY_ERROR.test(line)) errorHeaders++;
    }
    const errors = Math.max(errorHeaders, dueTo, couldNot ? 1 : 0);
    return { runner: "cargo build", passed: 0, failed: 0, errors, skipped: 0, warnings: Math.max(generated, headers), failing: [], summary_line: summary };
  }
};
var parsers3 = [unittest, clippy, golangci, viteParser, cargoBuild];

// src/engine/runners/php-ruby.ts
var MAX_FAILING4 = 10;
var MAX_NAME4 = 120;
var MAX_SUMMARY4 = 200;
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
    const c = cap(n, MAX_NAME4);
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, MAX_FAILING4);
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
      summary_line: last ? cap(last.line, MAX_SUMMARY4) : null
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
      summary_line: last ? cap(last.line, MAX_SUMMARY4) : null
    };
  }
};
var parsers4 = [phpunit, rspec];

// src/engine/runners/python.ts
var MAX_FAILING5 = 10;
var MAX_ENTRY = 120;
var MAX_SUMMARY5 = 200;
var ANSI4 = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
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
  return text.replace(ANSI4, "").split(/\r\n|\r|\n/);
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
    const failing = [...failedIds, ...errorIds].slice(0, MAX_FAILING5).map((id) => cap2(id, MAX_ENTRY));
    const summary = last ?? empty;
    return {
      runner: "pytest",
      passed: tail.passed ?? 0,
      failed,
      errors,
      skipped: tail.skipped ?? 0,
      failing,
      summary_line: summary === null ? null : cap2(summary, MAX_SUMMARY5)
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
      failing: [...violations].slice(0, MAX_FAILING5).map((v) => cap2(v, MAX_ENTRY)),
      summary_line: summary === null ? null : cap2(summary, MAX_SUMMARY5)
    };
  }
};
var parsers5 = [pytest, ruff];

// src/engine/runners/index.ts
var PARSERS = [...parsers5, ...parsers2, ...parsers, ...parsers4, ...parsers3];
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
  const tokens = [];
  let current = "";
  let quote2 = null;
  const flush = /* @__PURE__ */ __name(() => {
    if (current) tokens.push(current);
    current = "";
  }, "flush");
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? "";
    if (quote2) {
      if (ch === quote2) quote2 = null;
      else if (ch === "\\" && quote2 === '"' && i + 1 < command.length) current += command[++i];
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote2 = ch;
      continue;
    }
    const two = command.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === "|&") {
      flush();
      tokens.push(two);
      i++;
    } else if (ch === "|" || ch === ";" || ch === "&" || ch === "\n" || ch === "(" || ch === ")") {
      flush();
      tokens.push(ch);
    } else if (ch === " " || ch === "	") {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
  return tokens;
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
  const tokens = tokenize(withoutHeredocs(command));
  let found = null;
  let segment = [];
  for (const token of [...tokens, ";"]) {
    if (!SEPARATORS.has(token)) {
      segment.push(token);
      continue;
    }
    const kind = checkKind(segment);
    if (kind) found = found ? { silent: found.silent && kind.silent } : kind;
    segment = [];
  }
  if (!found) return null;
  const masked = tokens.some((t) => t === "|" || t === "||" || t === "|&" || t === ";");
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
  return text;
}
__name(promptText, "promptText");
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
      if (found !== null) return { start: end + 1, prompt: found };
    }
    end = nl;
  }
  return { start: 0, prompt: null };
}
__name(lastPromptEnd, "lastPromptEnd");
function resultText(content) {
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((b) => b && typeof b.text === "string" ? b.text : "").join("\n") : "";
  return text.length > RESULT_TAIL ? text.slice(-RESULT_TAIL) : text;
}
__name(resultText, "resultText");
function statusOf(text, isError, silent) {
  const ev = parseEvidence(text);
  const bad = ev.runners.some((r) => r.failed + r.errors > 0);
  if (isError || bad || ev.exit_code !== null && ev.exit_code !== 0) return "failed";
  if (ev.trust === "parsed" && !ev.conflict) return "passed";
  if (ev.exit_code === 0) return "passed";
  if (silent && !FAILURE_MARKER.test(text)) return "passed";
  return "unknown";
}
__name(statusOf, "statusOf");
function analyzeTranscript(text) {
  const empty = { task: "", finalMessage: "", edits: [], checks: [], passedCheckAfterLastEdit: false };
  try {
    if (typeof text !== "string" || !text) return empty;
    const task = firstPrompt(text).slice(0, TASK_MAX);
    const { start } = lastPromptEnd(text);
    const edits = [];
    const calls = [];
    const byId = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    let finalMessage = "";
    let seq = 0;
    let lastEdit = -1;
    let pos = start;
    while (pos < text.length) {
      let end = text.indexOf("\n", pos);
      if (end === -1) end = text.length;
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
          if (call) call.status = statusOf(resultText(block.content), block.is_error === true, call.silent);
        }
        continue;
      }
      if (!/"type"\s*:\s*"assistant"/.test(line)) continue;
      const entry = parseLine(line);
      if (!entry || entry.type !== "assistant" || entry.isSidechain === true || !Array.isArray(entry.message?.content)) continue;
      const message = textOf(entry.message.content).trim();
      if (message) finalMessage = message;
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
            if (!edits.includes(path)) edits.push(path);
            lastEdit = seq++;
          }
        } else if (block.name === "Bash" && typeof block.input?.command === "string") {
          const kind = analyzeCommand(block.input.command);
          if (!kind) continue;
          const call = { cmd: block.input.command.slice(0, CMD_MAX), silent: kind.silent, seq: seq++, status: "unknown" };
          calls.push(call);
          if (id) byId.set(id, call);
        }
      }
    }
    const checks = calls.map((c) => ({ cmd: c.cmd, status: c.status }));
    const passedCheckAfterLastEdit = lastEdit >= 0 && calls.some((c) => c.seq > lastEdit && c.status === "passed");
    return { task, finalMessage: finalMessage.slice(-FINAL_MAX), edits, checks, passedCheckAfterLastEdit };
  } catch {
    return empty;
  }
}
__name(analyzeTranscript, "analyzeTranscript");

// src/hooks/stop.ts
var EXCERPT = 200;
function question(pack, id) {
  const q = pack.questions[id];
  if (!q) throw new Error(`pack has no question ${id}`);
  return q;
}
__name(question, "question");
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
async function stopGate(io2, _pluginRoot) {
  const started = io2.now();
  const { env } = io2;
  if (env["REFEREE_HOOKS"] === "off" || /^(?:false|0|no|off)$/i.test(env["CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED"]?.trim() ?? "")) return;
  let input;
  try {
    input = JSON.parse(await io2.readStdin());
  } catch {
    return;
  }
  if (typeof input?.cwd !== "string") return;
  const cwd = input.cwd;
  const project = loadProject(cwd);
  if (!project || project.hooks.stopGate === "off") return;
  const sessionId = typeof input.session_id === "string" ? input.session_id : "unknown";
  const dataDir = resolveDataDir(env, io2.home, cwd);
  const base2 = { id: newStopId(started), ts: new Date(started).toISOString(), session_id: sessionId, project: projectId(cwd), mode: "shadow" };
  const finish = /* @__PURE__ */ __name((skipped, rest = {}) => appendStop(dataDir, { ...base2, ...skipped ? { skipped } : {}, edits: 0, checks: 0, ms: Math.max(0, io2.now() - started), ...rest }), "finish");
  if (input.stop_hook_active === true) return finish("stop_hook_active");
  if (Array.isArray(input.background_tasks) && input.background_tasks.length > 0) return finish("background_tasks");
  if (typeof input.transcript_path !== "string") return finish("no_transcript");
  let text;
  try {
    text = readFileSync7(input.transcript_path, "utf8");
  } catch {
    return finish("no_transcript");
  }
  const facts3 = analyzeTranscript(text);
  const counts3 = { edits: facts3.edits.length, checks: facts3.checks.length };
  if (facts3.edits.length === 0) return finish("no_edits", counts3);
  if (facts3.passedCheckAfterLastEdit) return finish("check_passed_after_edit", counts3);
  const finalMessage = typeof input.last_assistant_message === "string" && input.last_assistant_message.trim() ? input.last_assistant_message.slice(-2e3) : facts3.finalMessage;
  try {
    const pack = loadPack(project.pack, packDirs(env));
    const session = new Session({
      command: "stop-gate",
      env,
      cwd,
      home: io2.home,
      platform: process.platform,
      now: io2.now,
      pack: { name: pack.name, version: `${pack.version}+${pack.hash}`, redact: pack.redact },
      profile: "hook",
      sessionId
    });
    const questions = {
      claims_done: question(pack, "stop.claims_done"),
      claims_verified: question(pack, "stop.claims_verified"),
      verification_applies: question(pack, "stop.verification_applies"),
      outcome: question(pack, "stop.outcome")
    };
    const state = { task: facts3.task, final_message: finalMessage, checks: facts3.checks.map((c) => ({ cmd: c.cmd, status: c.status })), edits: [...facts3.edits] };
    const [outcome] = await session.run([{ id: "stop", state, questions }]);
    session.record({ verdict: "shadow" });
    const decision = decideStop(outcome?.answers ?? null, pack, project.thresholds);
    if (!decision) return finish("jev_error", counts3);
    finish(void 0, { ...counts3, decision, task_excerpt: facts3.task.slice(0, EXCERPT), final_excerpt: finalMessage.slice(0, EXCERPT) });
  } catch (error) {
    finish(isRefereeError(error) && error.code === "breaker_open" ? "breaker_open" : "jev_error", counts3);
  }
}
__name(stopGate, "stopGate");

// src/hooks/main.ts
installAbortGuard();
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}
__name(readStdin, "readStdin");
var pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"] || dirname3(dirname3(fileURLToPath2(import.meta.url)));
var io = { env: process.env, home: homedir(), now: /* @__PURE__ */ __name(() => Date.now(), "now"), readStdin };
try {
  if (process.argv[2] === "session-start") {
    const out = await sessionStart(io, pluginRoot);
    if (out) process.stdout.write(out);
  } else if (process.argv[2] === "stop") {
    await stopGate(io, pluginRoot);
  }
} catch {
  process.exitCode = 0;
}
process.exitCode = 0;
