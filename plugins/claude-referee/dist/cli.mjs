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
      for (const [name, question] of Object.entries(questions)) {
        if (question.type !== "score") continue;
        if (!Array.isArray(question.criteria)) throw new TypeSafeError(`Score question "${name}" has criteria that are not a list; score criteria must be a list of descriptions indexed by score from zero.`);
        if (question.criteria.length < 2) throw new TypeSafeError(`Score question "${name}" has ${question.criteria.length} criteria; at least two scores are required.`);
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
  APIUserAbortError: "timeout"
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
function classify(error) {
  if (error instanceof RefereeError) return error;
  const e = typeof error === "object" && error !== null ? error : {};
  const status = typeof e.status === "number" ? e.status : void 0;
  const code = (typeof e.name === "string" ? BY_NAME[e.name] : void 0) ?? (status !== void 0 ? byStatus(status) : void 0) ?? byMessage(typeof e.message === "string" ? e.message : String(error)) ?? "internal";
  const [message, next] = MESSAGES[code] ?? MESSAGES.internal ?? ["Unexpected error.", ""];
  return new RefereeError(code, message, {
    next_step: next,
    ...status !== void 0 ? { status } : {},
    ...code === "rate_limited" && typeof e.retryAfterMs === "number" ? { retry_after_ms: e.retryAfterMs } : {}
  });
}
__name(classify, "classify");

// src/engine/client.ts
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
async function guarded(options, fn) {
  const sdk = await Promise.resolve().then(() => (init_dist(), dist_exports));
  const budgetSignal = AbortSignal.timeout(options.budget.budgetMs);
  const signal = options.signal ? AbortSignal.any([options.signal, budgetSignal]) : budgetSignal;
  try {
    const client = new sdk.TypeSafeClient({
      apiKey: options.key,
      logLevel: "warn",
      logger: stderrLogger,
      timeout: options.budget.perAttemptMs,
      retry: { maxRetries: options.budget.maxRetries },
      ...options.baseURL ? { baseURL: options.baseURL } : {}
    });
    return await fn(client, signal);
  } catch (error) {
    if (budgetSignal.aborted) {
      throw new RefereeError("timeout", `Jev did not answer within ${options.budget.budgetMs} ms.`, {
        next_step: "Try again later; the verdict is unknown, not negative."
      });
    }
    throw classify(error);
  }
}
__name(guarded, "guarded");
function listModels(options) {
  return guarded(options, async (client, signal) => (await client.models.list({ signal })).map((m) => m.name));
}
__name(listModels, "listModels");

// src/engine/config.ts
var KIT = "claude-referee";
var VERSION2 = "0.1.0";
var DEFAULT_MODEL = "jev-1.13.0";
var MARKETPLACE = "claude-referee";
var DETAIL_LIMIT = 1500;
var ERROR_LIMIT = 2e3;
var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var PROFILES = {
  cli: { budgetMs: 3e4, perAttemptMs: 1e4, maxRetries: 2 },
  hook: { budgetMs: 2e3, perAttemptMs: 1500, maxRetries: 0 }
};
function resolveModel(env) {
  return env["TYPESAFE_MODEL"]?.trim() || env["CLAUDE_PLUGIN_OPTION_MODEL"]?.trim() || DEFAULT_MODEL;
}
__name(resolveModel, "resolveModel");

// src/engine/datadir.ts
import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
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
function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
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
  const hooks = "Hooks can also use /plugin configure claude-referee.";
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

// src/engine/pack.ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync as readdirSync2 } from "node:fs";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
function bundledPackDirs() {
  const here = dirname(fileURLToPath(import.meta.url));
  return [join2(here, "..", "packs"), join2(here, "packs"), join2(here, "..", "..", "plugins", "claude-referee", "packs")];
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
function hashDir(dir) {
  const hash = createHash("sha256");
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
function listPacks(dirs) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const { dir, source } of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync2(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || seen.has(entry.name) || !existsSync(join2(dir, entry.name, "pack.json"))) continue;
      seen.add(entry.name);
      const meta = readJson(join2(dir, entry.name, "pack.json"));
      out.push({ name: entry.name, version: typeof meta.version === "string" ? meta.version : "0.0.0", hash: hashDir(join2(dir, entry.name)), source });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
__name(listPacks, "listPacks");

// src/engine/project.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname2, join as join3, relative, sep } from "node:path";
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

// src/cli/commands/doctor.ts
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
    const dataDir = resolveDataDir(io.env, io.home, io.cwd, flags.dataDir);
    const projectFile = findProjectFile(io.cwd);
    const ready = nodeOk(node) && keySource !== null && (online === null || online === "ok");
    const nextStep = !nodeOk(node) ? "Install Node 20.3 or later on the PATH Claude Code uses." : keyError === "no_api_key" ? noKeyNextStep(io.platform) : keyError ? "The stored key is malformed; store it again." : online && online !== "ok" ? `The key check failed (${online}).` : void 0;
    return {
      ok: true,
      verdict: ready ? "ready" : "not_ready",
      version: VERSION2,
      node,
      claude,
      key_source: keySource,
      ...keyError ? { key_error: keyError } : {},
      ...online ? { online } : {},
      ...models ? { models } : {},
      model: resolveModel(io.env),
      data_dir: tildify(dataDir, io.home),
      data_bytes: dirSize(dataDir),
      packs: listPacks(packDirs(io.env)),
      project: projectFile ? tildify(projectFile, io.home) : null,
      next_step: nextStep
    };
  }
};

// src/cli/commands/index.ts
var commands = [doctor];

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
import { join as join5 } from "node:path";
import { parseArgs } from "node:util";

// src/engine/output.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join as join4 } from "node:path";
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
  mkdirSync(options.detailsDir, { recursive: true });
  const path = join4(options.detailsDir, `${options.receipt}.json`);
  writeFileSync(path, JSON.stringify(rounded, null, 2) + "\n");
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

// src/cli/run.ts
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
function usage(commands2) {
  const width = Math.max(...commands2.map((c) => c.name.length), 4);
  const lines = commands2.map((c) => `  ${c.name.padEnd(width)}  ${c.describe.summary}`);
  return [
    `${KIT} ${VERSION2}`,
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
  const str = /* @__PURE__ */ __name((key) => typeof values[key] === "string" ? values[key] : void 0, "str");
  return {
    pretty: values["pretty"] === true,
    dryRun: values["dry-run"] === true,
    fresh: values["fresh"] === true,
    verbose: values["verbose"] === true,
    dataDir: str("data-dir"),
    pack: str("pack"),
    failOn: (str("fail-on") ?? "").split(",").map((v) => v.trim()).filter(Boolean)
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
    io.write(`${VERSION2}
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
      io.write(JSON.stringify({ command: command.name, ...command.describe }, null, pretty ? 2 : 0) + "\n");
      return 0;
    }
    const result = await command.run({ io, flags, values: parsed.values, positionals: parsed.positionals });
    const receipt = typeof result["receipt"] === "string" ? result["receipt"] : null;
    const detailsDir = flags.dryRun ? null : join5(resolveDataDir(io.env, io.home, io.cwd, flags.dataDir), "results");
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
