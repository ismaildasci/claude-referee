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
        super((resolve6) => resolve6(void 0));
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
    sleep = /* @__PURE__ */ __name((ms, signal) => new Promise((resolve6, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const onAbort = /* @__PURE__ */ __name(() => {
        clearTimeout(timer);
        reject(signal?.reason);
      }, "onAbort");
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve6();
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
    resolveRetryPolicy = /* @__PURE__ */ __name((base, overrides) => {
      const o = overrides ?? {};
      return {
        maxRetries: o.maxRetries === void 0 ? base.maxRetries : assertNonNegativeInteger("retry.maxRetries", o.maxRetries),
        backoffInitialMs: o.backoffInitialMs === void 0 ? base.backoffInitialMs : assertNonNegativeMs("retry.backoffInitialMs", o.backoffInitialMs),
        backoffMaxMs: o.backoffMaxMs === void 0 ? base.backoffMaxMs : assertNonNegativeMs("retry.backoffMaxMs", o.backoffMaxMs),
        backoffJitter: o.backoffJitter === void 0 ? base.backoffJitter : assertFraction("retry.backoffJitter", o.backoffJitter),
        httpStatuses: new Set(o.httpStatuses === void 0 ? base.httpStatuses : assertStatusSet("retry.httpStatuses", o.httpStatuses)),
        respectRetryAfter: o.respectRetryAfter ?? base.respectRetryAfter,
        maxRetryAfterMs: o.maxRetryAfterMs === void 0 ? base.maxRetryAfterMs : assertNonNegativeMs("retry.maxRetryAfterMs", o.maxRetryAfterMs),
        apiConnectionError: o.apiConnectionError ?? base.apiConnectionError,
        apiTimeoutError: o.apiTimeoutError ?? base.apiTimeoutError
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

// src/cli/commands/decide.ts
import { readFileSync as readFileSync7, statSync as statSync3 } from "node:fs";
import { resolve as resolve3 } from "node:path";

// src/engine/config.ts
var KIT = "claude-referee";
var VERSION = "0.1.0";
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
function threshold(pack, project, question2, key, fallback) {
  const base = pack.thresholds[question2]?.[key] ?? fallback;
  const override = project?.[question2]?.[key];
  return typeof override === "number" && override > base ? Math.min(override, 1) : base;
}
__name(threshold, "threshold");

// src/cli/shared.ts
import { readFileSync as readFileSync6, statSync as statSync2 } from "node:fs";
import { resolve as resolve2 } from "node:path";

// src/engine/output.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";
function roundNumber(key, value) {
  if (Number.isInteger(value)) return value;
  const digits = key.endsWith("_usd") ? 6 : 2;
  return Number(value.toFixed(digits));
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
  const base = readProjectFile(file);
  const localFile = join3(dirname2(file), "referee.local.json");
  const local = existsSync2(localFile) ? readProjectFile(localFile) : {};
  const merged = { ...base, ...local, hooks: { ...base.hooks, ...local.hooks } };
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
var runCommand = /* @__PURE__ */ __name((file, args, timeoutMs) => new Promise((resolve6) => {
  execFile(
    file,
    [...args],
    { timeout: timeoutMs, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 },
    (error, stdout) => resolve6(error ? null : stdout)
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

// src/engine/receipts.ts
import { appendFileSync, existsSync as existsSync3, mkdirSync as mkdirSync4, readdirSync as readdirSync3, readFileSync as readFileSync5 } from "node:fs";
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
function appendReceipt(dataDir, receipt) {
  try {
    const dir = join7(receiptsDir(dataDir), receipt.project);
    mkdirSync4(dir, { recursive: true });
    appendFileSync(join7(dir, `${receipt.ts.slice(0, 7)}.jsonl`), JSON.stringify(receipt) + "\n");
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
function replaceIn(text, home, extra, counts) {
  const bump = /* @__PURE__ */ __name((kind) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
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
        const base = options.keepKeys ? key : replaceIn(key, options.home, extraReplace, replaced);
        let safeKey = base;
        for (let n = 2; Object.hasOwn(out, safeKey); n++) safeKey = `${base}#${n}`;
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
    this.keyPromise ??= resolveKey(this.options.env, this.options.platform);
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
  const base = typeof instructions === "object" && instructions !== null && !Array.isArray(instructions) ? instructions : { question: instructions };
  return { ...base, ...data };
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
      const verdict = !disagree && p1 >= clearAt && p1 - p2 >= margin ? "clear" : !disagree && p1 - p2 >= margin ? "weak" : "tie";
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
      key_source: "Where the key was found: plugin_setting, TYPESAFE_API_KEY, EVAL_TYPESAFE_API_KEY, TYPESAFE_API_KEY_CMD or keychain. Never the key.",
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
      const resolved = await resolveKey(io.env, io.platform);
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
    const nextStep = !nodeOk(node) ? "Install Node 20.3 or later on the PATH Claude Code uses." : keyError === "no_api_key" ? noKeyNextStep(io.platform) : keyError ? "The stored key is malformed; store it again." : online && online !== "ok" ? `The key check failed (${online}).` : void 0;
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

// src/cli/commands/done.ts
var NEXT = {
  missing: "The evidence doesn't show the criterion. Run the check that proves it and pipe its output in; the same evidence gives the same answer.",
  unsure: "The evidence is ambiguous. Pipe the full output of the check that proves the criterion, or narrow the criterion."
};
function doneEvidence(text) {
  return clip(stripAnsi(text), 2e3, 12e3);
}
__name(doneEvidence, "doneEvidence");
function doneRequest(pack, thresholds, criteria, evidence) {
  const base = question(pack, "done.met");
  const questions = Object.fromEntries(criteria.map((criterion, i) => [`c${i + 1}`, { ...base, instructions: withData(base.instructions, { criterion }) }]));
  const met = threshold(pack, thresholds, "done.met", "met", 0.7);
  const missing = threshold(pack, thresholds, "done.met", "missing", 0.5);
  const finish = /* @__PURE__ */ __name(([outcome]) => {
    const per = criteria.map((_, i) => {
      const answer = outcome?.answers?.[`c${i + 1}`];
      const p = answer?.type === "noul" ? answer.noul : 0;
      const verdict2 = p >= met ? "met" : p < missing ? "missing" : "unsure";
      return { i: i + 1, verdict: verdict2, p };
    });
    const verdict = per.some((c) => c.verdict === "missing") ? "missing" : per.some((c) => c.verdict === "unsure") ? "unsure" : "met";
    return {
      ok: true,
      verdict,
      p: Math.min(...per.map((c) => c.p)),
      ...per.length > 1 ? { criteria: per } : {},
      next_step: verdict === "met" ? void 0 : NEXT[verdict]
    };
  }, "finish");
  return { planned: [{ id: "done", state: { evidence }, questions }], finish };
}
__name(doneRequest, "doneRequest");
var done = {
  name: "done",
  describe: {
    summary: "Check whether piped test or lint output shows that each criterion holds.",
    inputs: {
      "--criteria <text>": 'What must hold, e.g. "all tests pass". Repeat for several; max 10.',
      "--evidence <file|->": "The check output. '-' or omitted reads stdin. ANSI colours are stripped; long output keeps its first 2,000 and last 12,000 characters."
    },
    outputs: {
      verdict: "met, unsure or missing; the lowest across criteria",
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
    return jevCommand(context, "done", pack, planned, finish);
  }
};

// src/cli/commands/eval.ts
import { appendFileSync as appendFileSync2, existsSync as existsSync4, readdirSync as readdirSync4, readFileSync as readFileSync8 } from "node:fs";
import { join as join8, resolve as resolve4 } from "node:path";

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
function findRecording(lines, key) {
  const forCase = lines.filter((l) => l.case === key.case && l.model === key.model);
  const match = [...forCase].reverse().find((l) => l.qhash === key.qhash && l.shash === key.shash);
  if (match) return { status: "ok", line: match };
  return { status: forCase.length > 0 ? "stale" : "missing" };
}
__name(findRecording, "findRecording");
var ratio = /* @__PURE__ */ __name((a, b) => b === 0 ? null : a / b, "ratio");
function metrics(items, positive) {
  const verdicts = { met: 0, unsure: 0, missing: 0 };
  for (const item of items) verdicts[item.verdict] = (verdicts[item.verdict] ?? 0) + 1;
  const predicted = items.filter((i) => i.verdict === positive);
  const actual = items.filter((i) => i.expected === positive);
  const truePositive = predicted.filter((i) => i.expected === positive).length;
  const decided = items.filter((i) => i.verdict !== "unsure").length;
  return {
    cases: items.length,
    verdicts,
    precision: ratio(truePositive, predicted.length),
    recall: ratio(truePositive, actual.length),
    automation: ratio(decided, items.length) ?? 0,
    wrong_positive: predicted.length - truePositive,
    wrong_negative: items.filter((i) => i.expected === positive && i.verdict !== positive && i.verdict !== "unsure").length
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

// src/cli/commands/eval.ts
var LIST_LIMIT = 20;
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
    positive: typeof raw["positive"] === "string" ? raw["positive"] : "met",
    max_wrong_positive: typeof raw["max_wrong_positive"] === "number" ? raw["max_wrong_positive"] : 0
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
function request(context, pack, suite, item) {
  if (suite.config.command !== "done") throw new RefereeError("bad_input", `Suite ${suite.name} uses ${suite.config.command}; eval handles done suites for now.`);
  const evidence = doneEvidence(typeof item["evidence"] === "string" ? item["evidence"] : "");
  if (!evidence.trim()) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: the evidence is empty.`);
  const { planned, finish } = doneRequest(pack, void 0, criteriaFor(suite, item), evidence);
  const first = planned[0];
  if (!first) throw new RefereeError("internal", "done planned no request.");
  const redacted = redactRequest(first, context.io.home, pack.redact);
  return { suite, item, planned: { ...first, id: `${suite.name}/${item.id}` }, finish, qhash: questionHash(first.questions), shash: stateHash(redacted.body.state) };
}
__name(request, "request");
async function record(context, pack, list2) {
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
      if (!flags.fresh && findRecording(suite.recordings, { case: item.id, qhash: req.qhash, shash: req.shash, model: session.model }).status === "ok") skipped += 1;
      else todo.push(req);
    }
  }
  if (flags.dryRun) return fitLine({ ...session.dryRun(todo.map((t) => t.planned)), skipped });
  const outcomes = todo.length ? await session.run(todo.map((t) => t.planned), { partial: true }) : [];
  const failed = [];
  let recorded = 0;
  todo.forEach((req, i) => {
    const outcome = outcomes[i];
    if (!outcome?.answers) {
      failed.push(req.planned.id);
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
    ...failed.length ? { failed: failed.slice(0, LIST_LIMIT) } : {},
    ...session.stats(),
    next_step: failed.length ? "Run the same command again; recorded cases are skipped." : void 0,
    receipt: receipt.id
  });
}
__name(record, "record");
function scoreSuite(context, pack, suite, model, split, sweepSpec) {
  const items = suite.cases.filter((c) => !split || c.split === split).map((item) => {
    const req = request(context, pack, suite, item);
    const found = findRecording(suite.recordings, { case: item.id, qhash: req.qhash, shash: req.shash, model });
    if (found.status !== "ok") {
      const why = found.status === "missing" ? `no recording for ${model}` : "the question text or input changed since it was recorded";
      throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: ${why}.`, { next_step: `Run eval record --suite ${suite.name} with a key.` });
    }
    const result = req.finish([{ id: "done", answers: found.line.answers, stopped: [], cached: true }]);
    return { id: item.id, split: item.split, expected: item.expected, verdict: String(result["verdict"]), p: Number(result["p"]) };
  });
  const m = metrics(items, suite.config.positive);
  const swept = sweepSpec ? sweep(items, suite.config.positive, parseSweep(sweepSpec)) : null;
  return {
    suite: suite.name,
    verdict: m.wrong_positive > suite.config.max_wrong_positive ? "violated" : "pass",
    ...m,
    max_wrong_positive: suite.config.max_wrong_positive,
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
      "--evals-dir <dir>": "Where the suites live; default jev-evals in the current directory.",
      "--split <dev|holdout>": "score: only cases from this split.",
      "--sweep <from:to:step>": "score: precision, recall and wrong positives per threshold; suggests one only with at least 10 cases per class.",
      "--fresh": "record: record every case again, even ones already recorded for this question text, input and model."
    },
    outputs: {
      verdict: "record: recorded or partial; score: pass, or violated when wrong positives exceed the suite's max_wrong_positive",
      recorded: "record: cases recorded now",
      skipped: "record: cases already recorded",
      verdicts: "score: count per verdict",
      precision: "score: share of positive verdicts that were right",
      recall: "score: share of expected positives found",
      automation: "score: share of cases with a definite verdict",
      wrong_positive: "score: positive verdicts that should not be; the kill criterion"
    },
    errors: [...JEV_ERRORS],
    effects: "record sends each unrecorded case to the TypeSafe API and appends to recorded.jsonl; score reads files only.",
    cost: "record: one Jev request per case not yet recorded. score: free and offline."
  },
  options: { suite: { type: "string" }, split: { type: "string" }, sweep: { type: "string" }, "evals-dir": { type: "string" } },
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

// src/cli/commands/judge.ts
var MAX_ITEMS = 500;
var LIST_LIMIT2 = 20;
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
  const lines = text.split(/\r?\n/);
  const jsonl = lines.filter((l) => l.trim()).every((l) => l.trim().startsWith("{"));
  return lines.map((line, i) => {
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
            if (p >= band) {
              yes += 1;
              flagged.push(label);
            } else if (p <= 1 - band) {
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
          ...flagged.length ? { flagged: flagged.slice(0, LIST_LIMIT2) } : {},
          ...reviewIds.length ? { review_ids: reviewIds.slice(0, LIST_LIMIT2) } : {},
          ...stopped.length ? { stopped } : {},
          ...unanswered.length ? { unanswered: unanswered.slice(0, LIST_LIMIT2), next_step: "Some items got no answer; run judge again on those items." } : {}
        };
      },
      { batch: true }
    );
  }
};

// src/cli/commands/receipts.ts
import { mkdirSync as mkdirSync5, writeFileSync as writeFileSync4 } from "node:fs";
import { dirname as dirname3, resolve as resolve5 } from "node:path";

// src/engine/usage.ts
import { existsSync as existsSync5, readdirSync as readdirSync5, readFileSync as readFileSync9 } from "node:fs";
import { join as join9 } from "node:path";
var SEPARATORS = /* @__PURE__ */ new Set(["&&", "||", "|", "|&", ";", "&", "\n", "(", ")"]);
var ASSIGNMENT2 = /^[A-Za-z_][A-Za-z0-9_]*=/;
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
  let quote = null;
  const flush = /* @__PURE__ */ __name(() => {
    if (current) tokens.push(current);
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
function subcommand(token) {
  return token && /^[a-z][a-z-]*$/.test(token) ? token : "other";
}
__name(subcommand, "subcommand");
function callIn(segment) {
  let i = 0;
  while (i < segment.length && (ASSIGNMENT2.test(segment[i] ?? "") || ["{", "time", "exec", "command", "env"].includes(segment[i] ?? ""))) i++;
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
  for (const token of [...tokenize(withoutHeredocs(command)), ";"]) {
    if (!SEPARATORS.has(token)) {
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
  if (!existsSync5(dir)) return [];
  const files = [];
  for (const entry of readdirSync5(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push({ path: join9(dir, entry.name), subagent: false });
    const sub = join9(dir, entry.name, "subagents");
    if (entry.isDirectory() && existsSync5(sub)) {
      for (const name of readdirSync5(sub).filter((n) => n.endsWith(".jsonl")).sort()) files.push({ path: join9(sub, name), subagent: true });
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
  const configDir = env["CLAUDE_CONFIG_DIR"]?.trim() || join9(home, ".claude");
  return [.../* @__PURE__ */ new Set([cwd, projectRoot(cwd)])].map((p) => join9(configDir, "projects", p.replace(/[^A-Za-z0-9]/g, "-")));
}
__name(projectTranscriptDirs, "projectTranscriptDirs");
function scanUsage(dirs, since) {
  const files = [...new Map(dirs.flatMap(transcriptFiles).map((f) => [f.path, f])).values()];
  const calls = /* @__PURE__ */ new Map();
  const sizes = /* @__PURE__ */ new Map();
  for (const file of files) {
    for (const line of readFileSync9(file.path, "utf8").split("\n")) {
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
      "--out <file>": "Target file for export.",
      "--tokens": "Rows per day and command: runs, requests, cache hits, input tokens and the share of --fresh runs.",
      "--usage": "Claude-side: claude-referee CLI calls per day and command, counted from this project's Claude Code transcripts (subagents included, each tool call once), with the size of what each call returned. Nothing from the transcripts is printed.",
      "--all": "Every project instead of the current one.",
      "--days <n>": "How many days back to include; default 30, or 14 with --tokens."
    },
    outputs: {
      verdict: "summary, tokens, usage or exported",
      runs: "Command runs in the window",
      requests: "Jev requests made",
      cached: "Answers served from the cache or merged with an identical request",
      input_tokens: "Input tokens billed",
      cost_usd: "Estimated cost at list price",
      by_command: "Runs per command",
      rows: "With --tokens: one row per day and command. With --usage: day, command, calls, subagent_calls and result_chars",
      transcripts: "With --usage: how many transcript files were read"
    },
    errors: ["bad_input"],
    effects: "Reads the data directory, and with --usage this project's Claude Code transcripts; export writes one file.",
    cost: "Free."
  },
  options: { out: { type: "string" }, tokens: { type: "boolean" }, usage: { type: "boolean" }, all: { type: "boolean" }, days: { type: "string" } },
  async run(context) {
    const { io, flags, values, positionals } = context;
    const dataDir = resolveDataDir(io.env, io.home, io.cwd, flags.dataDir);
    if (positionals[0] === "export") {
      const out = str(context, "out");
      if (!out) throw new RefereeError("bad_input", "export needs --out <file>.");
      const all = readReceipts(dataDir);
      const path = resolve5(io.cwd, out);
      mkdirSync5(dirname3(path), { recursive: true });
      writeFileSync4(path, all.map((r) => JSON.stringify(r)).join("\n") + (all.length ? "\n" : ""));
      return { ok: true, verdict: "exported", receipts: all.length, out: tildify(path, io.home) };
    }
    if (positionals.length > 0) throw new RefereeError("bad_input", `Unknown receipts action: ${positionals[0]}`);
    const tokens = values["tokens"] === true;
    const usage2 = values["usage"] === true;
    const days = Number(str(context, "days") ?? (tokens || usage2 ? 14 : 30));
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new RefereeError("bad_input", "--days must be a whole number from 1 to 366.");
    const since = new Date(io.now() - days * 864e5).toISOString();
    if (usage2) {
      const { transcripts, rows } = scanUsage(projectTranscriptDirs(io.env, io.home, io.cwd), since);
      return { ok: true, verdict: "usage", days, project: projectId(io.cwd), transcripts, calls: rows.reduce((n, r) => n + r.calls, 0), rows };
    }
    const scoped = readReceipts(dataDir, values["all"] === true ? void 0 : projectId(io.cwd)).filter((r) => r.ts >= since);
    if (tokens) {
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

// src/cli/commands/verify.ts
var MAX_CLAIMS = 100;
var verify = {
  name: "verify",
  describe: {
    summary: "Check claims against a source text.",
    inputs: {
      "--source <file|->": "The text the claims must be supported by. '-' reads stdin.",
      "--claim <text>": "A claim; repeat for several.",
      "--claims <file>": "Claims as a JSON array of strings or {id, text}, JSON lines, or plain lines. Max 100."
    },
    outputs: {
      verdict: "supported when every claim is, unsupported when any is, unsure otherwise (including claims with no answer)",
      claims: "Number of claims checked",
      supported: "Number of supported claims",
      unsupported: "Ids of unsupported claims",
      unsure: "Ids of claims between the bands",
      unanswered: "Ids of claims with no answer because of an API error or the 90-second deadline",
      p: "Probability of support for each unsupported or unsure claim, by id"
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: `${JEV_COST} verify asks all claims about one source in one request when they fit.`
  },
  options: { source: { type: "string" }, claim: { type: "string", multiple: true }, claims: { type: "string" } },
  async run(context) {
    const claimsFile = str(context, "claims");
    const inline = list(context, "claim");
    if (claimsFile && inline.length) throw new RefereeError("bad_input", "Use --claim or --claims, not both.");
    if (claimsFile === "-" && (str(context, "source") ?? "-") === "-") throw new RefereeError("bad_input", "Only one of --source and --claims can read stdin.");
    const claims = (claimsFile ? parseItems(await readSource(context, claimsFile, "claims")) : inline.map((text, i) => ({ id: String(i + 1), text }))).filter(
      (c) => c.text.trim()
    );
    if (claims.length === 0) throw new RefereeError("bad_input", "Give at least one --claim or a --claims file.");
    if (claims.length > MAX_CLAIMS) throw new RefereeError("too_large", `At most ${MAX_CLAIMS} claims per call.`);
    const source = stripAnsi(await readSource(context, str(context, "source"), "source"));
    const { pack, project } = openPack(context);
    const base = question(pack, "verify.supported");
    const state = { source };
    const stateTokens = estimateTokens(JSON.stringify(state));
    if (stateTokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", "The source is too large for one Jev request.", { next_step: "Pass the relevant section of the source." });
    const planned = [];
    let batch = {};
    let batchTokens = stateTokens;
    const flush = /* @__PURE__ */ __name(() => {
      if (Object.keys(batch).length) planned.push({ id: `part${planned.length + 1}`, state, questions: batch });
      batch = {};
      batchTokens = stateTokens;
    }, "flush");
    for (const claim of claims) {
      const q = { ...base, instructions: withData(base.instructions, { claim: claim.text }) };
      const tokens = estimateTokens(JSON.stringify(q));
      if (stateTokens + tokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", `Claim ${claim.id} is too long.`);
      if (batchTokens + tokens > REQUEST_TOKEN_LIMIT) flush();
      batch[`claim:${claim.id}`] = q;
      batchTokens += tokens;
    }
    flush();
    const supportedAt = threshold(pack, project?.thresholds, "verify.supported", "supported", 0.9);
    const unsupportedAt = threshold(pack, project?.thresholds, "verify.supported", "unsupported", 0.1);
    return jevCommand(context, "verify", pack, planned, (outcomes) => {
      const answers = Object.assign({}, ...outcomes.map((o) => o.answers ?? {}));
      let supported = 0;
      const unsupported = [];
      const unsure = [];
      const unanswered = [];
      const listed = {};
      for (const claim of claims) {
        const answer = answers[`claim:${claim.id}`];
        if (!answer) {
          unanswered.push(claim.id);
          continue;
        }
        const p = answer.type === "noul" && typeof answer.noul === "number" ? answer.noul : 0.5;
        if (p >= supportedAt) {
          supported += 1;
          continue;
        }
        (p <= unsupportedAt ? unsupported : unsure).push(claim.id);
        listed[claim.id] = p;
      }
      const verdict = unsupported.length ? "unsupported" : unsure.length || unanswered.length ? "unsure" : "supported";
      return {
        ok: true,
        verdict,
        claims: claims.length,
        supported,
        ...unsupported.length ? { unsupported } : {},
        ...unsure.length ? { unsure } : {},
        ...unanswered.length ? { unanswered } : {},
        ...Object.keys(listed).length ? { p: listed } : {},
        next_step: verdict === "supported" ? void 0 : "Fix or drop the listed claims, or cite the part of the source that supports them."
      };
    }, { partial: true });
  }
};

// src/cli/commands/index.ts
var commands = [done, decide, judge, verify, receipts, doctor, evalCommand];

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
import { join as join10 } from "node:path";
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
  const lines = commands2.map((c) => `  ${c.name.padEnd(width)}  ${c.describe.summary}`);
  return [
    `${KIT} ${VERSION}`,
    "",
    `Usage: ${KIT} <command> [options]`,
    "",
    "Commands:",
    ...lines,
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
    const detailsDir = flags.dryRun ? null : join10(resolveDataDir(io.env, io.home, io.cwd, flags.dataDir), "results");
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
process.exitCode = await run(process.argv.slice(2), processIo(), commands);
