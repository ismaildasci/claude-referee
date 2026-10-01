// doctor: Node and Claude Code versions, where the key comes from (never the key), data dir, packs and model.
// --online also lists the models the key can use, which checks the key without spending tokens.

import { listModels } from "../../engine/client.ts";
import { DEFAULT_BASE_URL, PROFILES, VERSION, resolveModel } from "../../engine/config.ts";
import { dirSize, resolveDataDir, tildify } from "../../engine/datadir.ts";
import { isRefereeError } from "../../engine/errors.ts";
import { isTypeSafeHost, noKeyNextStep, resolveEndpointKey, runCommand, type KeySource } from "../../engine/key.ts";
import { listPacks, packDirs } from "../../engine/pack.ts";
import { findProjectFile } from "../../engine/project.ts";
import type { Command } from "../types.ts";

function shownBaseUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  let url: URL;
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
  return shown === DEFAULT_BASE_URL ? undefined : shown;
}

function nodeOk(version: string): boolean {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  return major > 20 || (major === 20 && minor >= 3);
}

export const doctor: Command = {
  name: "doctor",
  describe: {
    summary: "Check Node, Claude Code, the key source, data directory, packs and model.",
    inputs: { "--online": "Also list the models the key can use (one free API call)." },
    outputs: {
      verdict: "ready or not_ready",
      key_source: "Where the key was found: REFEREE_BASE_URL_KEY (only for another host), plugin_setting, TYPESAFE_API_KEY, EVAL_TYPESAFE_API_KEY, TYPESAFE_API_KEY_CMD or keychain. Never the key.",
      packs: "Installed packs with version, content hash and source.",
      base_url: "Only when TYPESAFE_BASE_URL points somewhere other than the default; credentials and query are removed.",
      next_step: "What to fix when not ready.",
    },
    errors: ["bad_input"],
    effects: "Reads only. With --online, one request to list models.",
    cost: "Free.",
  },
  options: { online: { type: "boolean" } },
  async run({ io, flags, values }) {
    const node = process.version;
    const claude = (await runCommand("claude", ["--version"], 3000))?.trim().split(/\s+/)[0] ?? null;
    let keySource: KeySource | null = null;
    let keyError: string | null = null;
    let key: string | null = null;
    try {
      const resolved = await resolveEndpointKey(io.env, io.platform);
      keySource = resolved.source;
      key = resolved.key;
    } catch (error) {
      keyError = isRefereeError(error) ? error.code : "internal";
    }
    let models: string[] | null = null;
    let online: string | null = null;
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
    const nextStep = !nodeOk(node)
      ? "Install Node 20.3 or later on the PATH Claude Code uses."
      : keyError === "no_api_key" && !isTypeSafeHost(io.env["TYPESAFE_BASE_URL"])
        ? "TYPESAFE_BASE_URL points away from api.typesafe.ai: set REFEREE_BASE_URL_KEY to that host's key, or unset TYPESAFE_BASE_URL. The TypeSafe key is never sent there."
        : keyError === "no_api_key"
        ? noKeyNextStep(io.platform)
        : keyError
          ? "The stored key is malformed; store it again."
          : online && online !== "ok"
            ? `The key check failed (${online}).`
            : undefined;
    return {
      ok: true,
      verdict: ready ? "ready" : "not_ready",
      version: VERSION,
      node,
      claude,
      key_source: keySource,
      ...(keyError ? { key_error: keyError } : {}),
      ...(online ? { online } : {}),
      ...(models ? { models } : {}),
      model: resolveModel(io.env),
      ...(baseUrl ? { base_url: baseUrl } : {}),
      data_dir: tildify(dataDir, io.home),
      data_bytes: dirSize(dataDir),
      packs: listPacks(packDirs(io.env)),
      project: projectFile ? tildify(projectFile, io.home) : null,
      next_step: nextStep,
    };
  },
};
