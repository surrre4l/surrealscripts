
"use strict";

/**
 * surrealscripts.ui
 * Internal module: updates.js
 *
 * Coordinates script update checks using manifest metadata.
 *
 * Dependencies:
 * - registry.js
 * - versioning.js
 * - api.js (optional, for remote manifest checks)
 *
 * This module does not install, execute, or overwrite script files.
 */

(function (root) {
  let lastResult = null;
  let lastCheckedAt = null;
  let inFlight = null;

  function requireModule(name, moduleRef) {
    if (!moduleRef) {
      throw new Error(`${name} is unavailable. Load its module first.`);
    }

    return moduleRef;
  }

  function compareInstalled(availableScripts) {
    const registry = requireModule(
      "SurrealRegistry",
      root.SurrealRegistry
    );

    const versioning = requireModule(
      "SurrealVersioning",
      root.SurrealVersioning
    );

    if (!Array.isArray(availableScripts)) {
      throw new TypeError("Available scripts must be an array.");
    }

    const installedScripts = registry.list();
    const updates = versioning.findUpdates(
      installedScripts,
      availableScripts
    );

    const installedIds = new Set(
      installedScripts.map((script) => script.id)
    );

    const newScripts = availableScripts
      .filter((script) => !installedIds.has(script.id))
      .map((script) => ({
        id: script.id,
        name: script.name || script.id,
        version: script.version
      }));

    const result = {
      checkedAt: new Date().toISOString(),
      installedCount: installedScripts.length,
      availableCount: availableScripts.length,
      updateCount: updates.length,
      newScriptCount: newScripts.length,
      updates,
      newScripts
    };

    lastResult = result;
    lastCheckedAt = result.checkedAt;

    if (root.SurrealEvents) {
      root.SurrealEvents.emit("updates:checked", {
        checkedAt: result.checkedAt,
        updateCount: result.updateCount,
        newScriptCount: result.newScriptCount
      });
    }

    return cloneResult(result);
  }

  async function checkRemote(options = {}) {
    if (inFlight) return inFlight;

    if (typeof options.url !== "string" || !options.url.trim()) {
      throw new Error("A remote manifest URL is required.");
    }

    if (!root.SurrealAPI) {
      throw new Error("SurrealAPI is unavailable.");
    }

    inFlight = (async () => {
      try {
        const manifest = await root.SurrealAPI.getJson(
          options.url,
          {
            timeout: options.timeout,
            signal: options.signal,
            cache: options.cache || "no-cache"
          }
        );

        if (
          !manifest ||
          typeof manifest !== "object" ||
          !Array.isArray(manifest.scripts)
        ) {
          throw new Error("Remote manifest has an invalid structure.");
        }

        if (root.SurrealValidator) {
          const validation =
            root.SurrealValidator.validateManifest(manifest);

          if (
            validation === false ||
            (validation && validation.valid === false)
          ) {
            throw new Error("Remote manifest validation failed.");
          }
        }

        return compareInstalled(manifest.scripts);
      } catch (error) {
        if (root.SurrealEvents) {
          root.SurrealEvents.emit("updates:failed", {
            message: error instanceof Error
              ? error.message
              : String(error)
          });
        }

        throw error;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  function getLastResult() {
    return lastResult ? cloneResult(lastResult) : null;
  }

  function getStatus() {
    return {
      hasResult: lastResult !== null,
      lastCheckedAt,
      updateCount: lastResult ? lastResult.updateCount : 0,
      newScriptCount: lastResult ? lastResult.newScriptCount : 0,
      checking: inFlight !== null
    };
  }

  function cloneResult(result) {
    return {
      ...result,
      updates: result.updates.map((item) => ({ ...item })),
      newScripts: result.newScripts.map((item) => ({ ...item }))
    };
  }

  function clear() {
    lastResult = null;
    lastCheckedAt = null;
  }

  root.SurrealUpdates = Object.freeze({
    compareInstalled,
    checkRemote,
    getLastResult,
    getStatus,
    clear
  });
})(globalThis);
