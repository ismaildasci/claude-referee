// Loopback-only HTTP server of the local dashboard. Design and threats: docs/decisions/ui-security.md.
// Every request passes the Host check, API requests also Origin, Fetch-Metadata and a 128-bit token header; no CORS, no logging.
// A path with "//" or any backslash is refused before URL parsing, which would read "\" as "/"; a path that parsing
// changes (dot segments such as ".." or "%2e", characters it percent-encodes) is refused after it: only exact routes are served.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { RefereeError } from "../engine/errors.ts";
import { exportKind, flow, label, overview, privacy, queue, type UiContext } from "./api.ts";
import { APP_CSS, APP_JS, INDEX_HTML } from "./page.ts";

export const TOKEN_HEADER = "x-referee-token";
const MAX_BODY = 2048;

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export interface UiServer {
  readonly token: string;
  readonly port: number;
  readonly origin: string;
  readonly urlWithToken: string;
  close(): Promise<void>;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function baseHeaders(type: string): Record<string, string> {
  return {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Content-Security-Policy": CSP,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  };
}

function send(res: ServerResponse, status: number, type: string, body: string, extra: Record<string, string> = {}): void {
  res.writeHead(status, { ...baseHeaders(type), ...extra });
  res.end(body);
}

function json(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        chunks.length = 0;
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });
}

export async function startUi(ctx: UiContext, requestedPort = 0): Promise<UiServer> {
  const token = randomBytes(16).toString("hex");
  const tokenDigest = digest(token);
  let allowedHost = "";
  let allowedOrigin = "";

  const tokenOk = (req: IncomingMessage): boolean => {
    const given = req.headers[TOKEN_HEADER];
    return typeof given === "string" && given.length > 0 && timingSafeEqual(digest(given), tokenDigest);
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.headers.host !== allowedHost) return json(res, 403, { error: "bad_host" });
    if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    if (!req.url || !req.url.startsWith("/") || req.url.startsWith("//") || req.url.includes("\\")) return json(res, 400, { error: "bad_request" });
    const url = new URL(req.url, allowedOrigin);
    const route = url.pathname;
    if (route !== req.url.split(/[?#]/, 1)[0]) return json(res, 400, { error: "bad_request" });

    if (req.method === "GET" && route === "/") return send(res, 200, "text/html; charset=utf-8", INDEX_HTML);
    if (req.method === "GET" && route === "/app.js") return send(res, 200, "text/javascript; charset=utf-8", APP_JS);
    if (req.method === "GET" && route === "/app.css") return send(res, 200, "text/css; charset=utf-8", APP_CSS);
    if (!route.startsWith("/api/")) return json(res, 404, { error: "not_found" });

    const origin = req.headers.origin;
    if (origin !== undefined && origin !== allowedOrigin) return json(res, 403, { error: "bad_origin" });
    const site = req.headers["sec-fetch-site"];
    if (site !== undefined && site !== "same-origin") return json(res, 403, { error: "bad_origin" });
    if (req.method === "POST" && origin === undefined) return json(res, 403, { error: "bad_origin" });
    if (!tokenOk(req)) return json(res, 401, { error: "bad_token" });

    if (req.method === "GET") {
      if (route === "/api/flow") return json(res, 200, flow(ctx, { days: url.searchParams.get("days"), command: url.searchParams.get("command") }));
      if (route === "/api/queue") return json(res, 200, queue(ctx));
      if (route === "/api/overview") return json(res, 200, overview(ctx));
      if (route === "/api/privacy") return json(res, 200, privacy(ctx));
      if (route === "/api/export") {
        const out = exportKind(ctx, url.searchParams.get("kind"));
        if (!out) return json(res, 400, { error: "bad_kind" });
        return send(res, 200, "application/x-ndjson; charset=utf-8", out.body, { "Content-Disposition": `attachment; filename="${out.filename}"` });
      }
      return json(res, 404, { error: "not_found" });
    }

    if (route !== "/api/label") return json(res, 404, { error: "not_found" });
    if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) return json(res, 415, { error: "bad_content_type" });
    const raw = await readBody(req);
    if (raw === null) {
      res.once("finish", () => req.destroy());
      return send(res, 413, "application/json; charset=utf-8", JSON.stringify({ error: "too_large" }), { Connection: "close" });
    }
    let body: { id?: unknown; label?: unknown };
    try {
      body = JSON.parse(raw) as { id?: unknown; label?: unknown };
    } catch {
      return json(res, 400, { error: "bad_json" });
    }
    if (body === null || typeof body !== "object") return json(res, 400, { error: "bad_json" });
    const result = label(ctx, body.id, body.label);
    if (result === "ok") return json(res, 200, { ok: true, id: body.id, label: body.label });
    return json(res, result === "bad_input" ? 400 : 404, { error: result });
  };

  const server: Server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) json(res, 500, { error: "internal" });
      else res.end();
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 2_000;

  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      reject(new RefereeError("bad_input", error.code === "EADDRINUSE" ? "That port is already in use." : `Could not start the server: ${error.code ?? "error"}`, { next_step: "Omit --port to take a random free port." }));
    });
    server.listen(requestedPort, "127.0.0.1", resolve);
  });
  const port = (server.address() as AddressInfo).port;
  allowedHost = `127.0.0.1:${port}`;
  allowedOrigin = `http://${allowedHost}`;

  return {
    token,
    port,
    origin: allowedOrigin,
    urlWithToken: `${allowedOrigin}/#t=${token}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
